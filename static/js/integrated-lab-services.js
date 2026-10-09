/* Serviços educacionais: usam a configuração e o percurso da bancada, sem estado de rede paralelo. */
(function (root, factory) {
  const api=factory(typeof module==='object'&&module.exports?require('./integrated-lab-model.js'):root.NetStudyLabModel,
    typeof module==='object'&&module.exports?require('./integrated-lab-simulator.js'):root.NetStudyLabSimulator);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.NetStudyLabServices=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(model,simulator){
  'use strict';
  const tables=()=>({mac:[],arp:[],routes:[],nat:[]});
  const event=(id,observation,focusId,explanation,extra={})=>({id,eventId:'',observation,explanation,focusId,
    interfaceIds:[],connectionIds:[],incomingInterfaceId:null,outgoingInterfaceIds:[],fromId:null,toId:null,
    frame:null,packet:null,routerDecision:null,natTranslation:null,outcome:null,tables:tables(),...extra});
  const finish=(status,events,detail={})=>{
    events.forEach((item,index)=>{item.eventId=`event-${index+1}`;item.outcome=index===events.length-1?(status==='success'?'success':'failure'):null;});
    return {status,message:events.at(-1)?.observation||'Nenhum evento.',events,tables:tables(),...detail};
  };
  const pc=(state,id)=>state.devices[id]?.type==='pc'&&state.devices[id].position?state.devices[id]:null;
  const number=ip=>simulator.ipv4(ip)?.reduce((value,byte)=>((value*256)+byte)>>>0,0);
  const dotted=value=>[24,16,8,0].map(shift=>(value>>>shift)&255).join('.');
  function network(state,clientId,serverIp) {
    const adapted=model.adaptForPing(state,clientId);
    if(adapted.error)return {status:'invalid',message:adapted.error};
    return simulator.ping(adapted.input,serverIp);
  }
  function renew(state,clientId) {
    const client=pc(state,clientId),events=[];
    if(!client||!client.config.dhcpClient)return {result:finish('failure',[event('dhcp-disabled','Este host não está em modo DHCP.',clientId,'Ative DHCP no cliente antes de renovar.')])};
    events.push(event('dhcp-discover',`${client.name} envia DHCP Discover por broadcast.`,clientId,
      'Sem IPv4 atribuído, o cliente procura um servidor no domínio de broadcast da VLAN.',
      {frame:{id:'dhcp-discover',source:client.config.mac,destination:'FF:FF:FF:FF:FF:FF',type:'IPv4/UDP',kind:'dhcp-discover',label:'DHCP Discover',vlanTag:null}}));
    const candidates=Object.values(state.devices).filter(device=>device.id!==clientId&&device.type==='pc'&&device.position&&
      device.config.dhcpServer?.enabled&&simulator.ipv4(device.config.ip));
    const found=candidates.map(server=>({server,path:simulator.layer2Path(state,client.interfaces[0],server.interfaces[0])})).find(row=>row.path);
    if(!found)return {result:finish('failure',[...events,event('dhcp-timeout','Nenhum DHCP Offer alcançou o cliente.',clientId,
      'Verifique servidor, cabos, portas Access, VLAN e trunk; o broadcast DHCP não atravessa um roteador nesta etapa.')])};
    const {server,path}=found,pool=server.config.dhcpServer,used=new Set(Object.values(state.devices).filter(device=>device.type==='pc'&&device.id!==clientId).map(device=>device.config.ip));
    if(!simulator.ipv4(server.config.ip)||!simulator.mask(server.config.mask)||
        !simulator.sameSubnet(simulator.ipv4(server.config.ip),simulator.ipv4(pool.poolStart),simulator.mask(server.config.mask)))
      return {result:finish('failure',[...events,event('dhcp-pool-network',`${server.name} tem pool fora da rede de sua interface.`,server.id,
        'O servidor recebeu o Discover, mas esta configuração não pode ofertar um endereço da LAN.')])};
    for(const lease of Object.values(state.serviceRuntime?.leases||{}))if(lease.clientId!==clientId)used.add(lease.ip);
    used.add(server.config.ip);used.add(pool.gateway);
    const start=number(pool.poolStart),end=number(pool.poolEnd);
    const subnet=number(server.config.ip)&number(server.config.mask),broadcast=(subnet|(~number(server.config.mask)))>>>0;
    const offered=Array.from({length:end-start+1},(_,index)=>dotted(start+index)).find(ip=>!used.has(ip)&&number(ip)!==(subnet>>>0)&&number(ip)!==broadcast);
    if(!offered)return {result:finish('failure',[...events,event('dhcp-pool-empty',`${server.name} não tem endereço livre no pool.`,server.id,
      'A comunicação L2 chegou ao servidor, mas não há lease disponível.')])};
    events.push(event('dhcp-offer',`${server.name} oferece ${offered} a ${client.name}.`,server.id,
      `DHCP Offer inclui máscara, gateway e DNS configurados no servidor. VLAN ${path.vlan}.`,{connectionIds:path.connectionIds,
        frame:{id:'dhcp-offer',source:server.config.mac,destination:client.config.mac,type:'IPv4/UDP',kind:'dhcp-offer',label:'DHCP Offer',vlanTag:null}}));
    events.push(event('dhcp-request',`${client.name} solicita ${offered}.`,clientId,
      'DHCP Request confirma a oferta escolhida.',{connectionIds:path.connectionIds,
        frame:{id:'dhcp-request',source:client.config.mac,destination:'FF:FF:FF:FF:FF:FF',type:'IPv4/UDP',kind:'dhcp-request',label:'DHCP Request',vlanTag:null}}));
    const changed=model.configure(state,clientId,{ip:offered,mask:pool.mask,gateway:pool.gateway,dns:pool.dns,dhcpClient:true});
    if(changed.error)return {result:finish('failure',[...events,event('dhcp-error',changed.error,clientId,'A configuração não foi aplicada.')])};
    const lease={clientId,serverId:server.id,ip:offered,mask:pool.mask,gateway:pool.gateway,dns:pool.dns,leaseMinutes:pool.leaseMinutes};
    const bench={...changed.state,serviceRuntime:{...state.serviceRuntime,leases:{...(state.serviceRuntime?.leases||{}),[clientId]:lease}}};
    events.push(event('dhcp-ack',`${server.name} confirma o lease ${offered} para ${client.name}.`,clientId,
      `Máscara ${pool.mask}; gateway ${pool.gateway}; DNS ${pool.dns||'não informado'}; duração ${pool.leaseMinutes} min.`,{connectionIds:path.connectionIds,
        frame:{id:'dhcp-ack',source:server.config.mac,destination:client.config.mac,type:'IPv4/UDP',kind:'dhcp-ack',label:'DHCP Ack',vlanTag:null}}));
    return {bench,result:finish('success',events,{lease})};
  }
  function resolve(state,clientId,hostname) {
    const client=pc(state,clientId),events=[],name=String(hostname||'').trim().toLowerCase();
    if(!client||!/^[a-z0-9][a-z0-9.-]{0,252}$/.test(name))return finish('failure',[event('dns-invalid','Nome DNS inválido.',clientId,'Informe um nome de host.')]);
    const dnsIp=client.config.dns;
    if(!simulator.ipv4(dnsIp))return finish('failure',[event('dns-unconfigured',`${client.name} não tem servidor DNS configurado.`,clientId,'A resolução precisa de um endereço DNS válido.')]);
    events.push(event('dns-query',`${client.name} consulta o registro A de ${name} em ${dnsIp}.`,clientId,
      'A consulta DNS antecede uma conexão feita pelo nome.'));
    const reach=network(state,clientId,dnsIp);
    if(reach.status!=='reply')return finish('failure',[...events,event('dns-unreachable',`A consulta DNS não chegou a ${dnsIp}.`,clientId,
      'Confira o percurso IP até o servidor DNS; ainda não é possível concluir se o registro existe.')]);
    const server=Object.values(state.devices).find(device=>device.type==='pc'&&device.config.ip===dnsIp);
    if(!server?.config.dnsServer?.enabled)return finish('failure',[...events,event('dns-unavailable',`O host ${dnsIp} responde na rede, mas DNS está indisponível.`,server?.id||clientId,
      'Conectividade IP não garante que o serviço DNS esteja ativo.')]);
    const record=server.config.dnsServer.records.find(item=>item.name.toLowerCase()===name);
    if(!record)return finish('failure',[...events,event('dns-no-record',`${server.name} não encontrou registro A para ${name}.`,server.id,
      'O servidor DNS está acessível, mas não possui este nome.')]);
    events.push(event('dns-answer',`${server.name} responde: ${name} → ${record.address}.`,server.id,
      'O endereço retornado pode ser usado na próxima tentativa de conexão.'));
    return finish('success',events,{address:record.address,serverId:server.id});
  }
  function connect(state,clientId,target,protocol,port) {
    const client=pc(state,clientId),events=[];
    if(!client||!['tcp','udp'].includes(protocol)||!Number.isInteger(port)||port<1||port>65535)
      return finish('failure',[event('service-invalid','Destino, protocolo ou porta inválidos.',clientId,'Use TCP ou UDP e uma porta de 1 a 65535.')]);
    let address=target;
    if(!simulator.ipv4(target)) {
      const answer=resolve(state,clientId,target);events.push(...answer.events);
      if(answer.status!=='success')return finish('failure',events);
      address=answer.address;
    }
    events.push(event('service-attempt',`${client.name} tenta ${protocol.toUpperCase()} ${address}:${port}.`,clientId,
      'A resolução terminou; agora é necessário alcançar o host e a porta do serviço.'));
    const reach=network(state,clientId,address);
    if(reach.status!=='reply')return finish('failure',[...events,event('service-network-failed',`Não há percurso IP confirmado até ${address}.`,clientId,
      'Examine L2/L3 antes de atribuir a falha ao serviço.')]);
    events.push(event('service-network-ok',`O caminho IP de ida e volta até ${address} funciona.`,clientId,
      'O teste de conectividade confirma o caminho simulado; ainda falta verificar o serviço.'));
    const server=Object.values(state.devices).find(device=>device.type==='pc'&&device.config.ip===address);
    const service=server?.config.services?.find(item=>item.protocol===protocol&&item.port===port);
    if(!service?.enabled)return finish('failure',[...events,event('service-unavailable',
      `${address}:${port}/${protocol} não está disponível.`,server?.id||clientId,
      'L2/L3 e o endereço de destino funcionam; confira protocolo, porta e estado do serviço.')]);
    return finish('success',[...events,event('service-connected',
      `${service.name} está disponível em ${address}:${port}/${protocol}.`,server.id,
      protocol==='tcp'?'A conexão TCP simplificada foi estabelecida.':'A solicitação UDP simplificada recebeu resposta do serviço.')],
      {address,service:{...service}});
  }
  return Object.freeze({renew,resolve,connect});
});
