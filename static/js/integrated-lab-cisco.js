/* Adaptador Cisco IOS-like: consultas e configuração sobre o estado canônico da bancada. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./integrated-lab-profiles.js') : root.NetStudyLabProfiles,
    typeof module === 'object' && module.exports ? require('./integrated-lab-simulator.js') : root.NetStudyLabSimulator,
    () => typeof module === 'object' && module.exports ? require('./integrated-lab-model.js') : root.NetStudyLabModel,
    typeof module === 'object' && module.exports ? require('./integrated-lab-switch-cli.js') : root.NetStudyLabSwitchCLI);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NetStudyLabCisco = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (profiles, simulator, getModel, switchCLI) {
  'use strict';
  const showCommands = Object.freeze({
    switch: ['show interfaces', 'show interfaces status', 'show vlan brief', 'show interfaces trunk', 'show mac address-table', 'show running-config', 'show arp'],
    router: ['show ip interface brief', 'show interfaces', 'show ip route', 'show ip nat translations', 'show ip nat statistics', 'show arp', 'show running-config']
  });
  const mac = value => (value || '').replaceAll(':', '').toLowerCase().match(/.{1,4}/g)?.join('.') || '—';
  const name = (device, id) => profiles.interfaceName(device, id);
  const linkUp = (state, id) => state.connections.some(c => (c.a === id || c.b === id) && state.interfaces[c.a] && state.interfaces[c.b] &&
    ![c.a,c.b].some(port => state.devices[state.interfaces[port].deviceId]?.config?.portSettings?.[port]?.shutdown));
  const config = (device, index) => device.config[`eth${index}`];
  const rows = (device, state) => device.interfaces.map((id, index) => ({id, name: name(device, id), up: linkUp(state, id) && !device.config.portSettings?.[id]?.shutdown, mode: state.interfaces[id].mode, config: config(device, index)}));
  const tables = state => state.observation?.tables || {mac: [], arp: []};
  function show(command, device, state) {
    const ports = rows(device, state), output = [];
    if (command === 'show interfaces') {
      for (const p of ports) {
        const setting=device.config.portSettings?.[p.id]||{};
        output.push(`${p.name} is ${setting.shutdown?'administratively down':p.up?'up':'down'}, line protocol is ${p.up ? 'up' : 'down'}`);
        if(setting.description)output.push(`  Description: ${setting.description}`);
        if (p.config) output.push(`  Hardware is Ethernet, address is ${mac(p.config.mac)}`, `  Internet address is ${p.config.ip}/${simulator.mask(p.config.mask)?.flatMap(b => b.toString(2).split('')).filter(b => b === '1').length ?? '?'}`);
        else output.push(`  Layer 2 ${p.mode}${p.mode === 'access' ? `, access VLAN ${device.config.vlans[p.id]}` : ''}`);
      }
      output.push('Estado de enlace simulado a partir dos cabos; contadores físicos não são modelados.');
    } else if (command === 'show interfaces status') {
      output.push('Port                         Name  Status        Vlan');
      ports.forEach(p => output.push(`${p.name.padEnd(29)} -     ${(device.config.portSettings?.[p.id]?.shutdown?'disabled':p.up?'connected':'notconnect').padEnd(13)} ${p.mode === 'trunk' ? 'trunk' : device.config.vlans[p.id]}`));
    } else if (command === 'show vlan brief') {
      output.push('VLAN  Name                 Status    Ports');
      const vlans = [...new Set([1, ...Object.values(device.config.vlans), ...device.config.allowedVlans])].sort((a,b) => a-b);
      vlans.forEach(v => output.push(`${String(v).padEnd(5)} ${(v === 1 ? 'default' : `VLAN${String(v).padStart(4,'0')}`).padEnd(20)} active    ${ports.filter(p => p.mode === 'access' && device.config.vlans[p.id] === v).map(p => p.name).join(', ')}`));
      output.push('VLANs derivadas da configuração access/allowed da bancada; portas trunk não aparecem como access.');
    } else if (command === 'show interfaces trunk') {
      const trunks = ports.filter(p => p.mode === 'trunk' && p.up &&
        state.connections.some(c => (c.a===p.id||c.b===p.id) && state.interfaces[c.a] && state.interfaces[c.b] &&
          state.interfaces[c.a===p.id?c.b:c.a].mode==='trunk'));
      output.push('Port                         Mode  Encapsulation  Status');
      trunks.forEach(p => output.push(`${p.name.padEnd(29)} on    802.1q         trunking`));
      if (!trunks.length) output.push('Nenhum trunk operacional.');
      output.push('Port                         Vlans allowed on trunk');
      trunks.forEach(p => output.push(`${p.name.padEnd(29)} ${device.config.allowedVlans.join(',') || 'none'}`));
      output.push('Allowed list local; não garante permissão no outro switch. Native VLAN/STP não são modelados nesta bancada.');
    } else if (command === 'show mac address-table') {
      output.push('          Mac Address Table', 'Vlan    Mac Address       Type        Ports');
      const learned = tables(state).mac.filter(r => r.switchId === device.id && device.interfaces.includes(r.interfaceId));
      learned.forEach(r => output.push(`${String(r.vlan).padEnd(8)}${mac(r.mac).padEnd(18)}DYNAMIC     ${name(device, r.interfaceId)}`));
      output.push(`Total Mac Addresses for this criterion: ${learned.length}`, 'Entradas aprendidas até o evento selecionado.');
    } else if (command === 'show ip interface brief') {
      output.push('Interface                    IP-Address      OK? Method Status  Protocol');
      ports.forEach(p => output.push(`${p.name.padEnd(29)} ${(p.config.ip||'unassigned').padEnd(15)} YES ${p.config.ip?'manual':'unset'} ${(p.up?'up':device.config.portSettings?.[p.id]?.shutdown?'administratively down':'down').padEnd(22)} ${p.up ? 'up' : 'down'}`));
    } else if (command === 'show ip route') {
      const defaultRoute=(device.config.staticRoutes||[]).find(r=>r.destination==='0.0.0.0'&&r.mask==='0.0.0.0');
      const defaultActive=defaultRoute&&ports.some(p=>p.up&&simulator.ipv4(p.config.ip)&&simulator.mask(p.config.mask)&&simulator.sameSubnet(simulator.ipv4(defaultRoute.nextHop),simulator.ipv4(p.config.ip),simulator.mask(p.config.mask))&&defaultRoute.nextHop!==p.config.ip);
      output.push('Codes: C - connected, L - local, S - static',defaultActive?`Gateway of last resort is ${defaultRoute.nextHop}`:'Gateway of last resort is not set');
      for (const p of ports.filter(p => p.up)) {
        const ip = simulator.ipv4(p.config.ip), mask = simulator.mask(p.config.mask);
        if (ip && mask) output.push(`C    ${simulator.prefix(ip, mask)} is directly connected, ${p.name}`, `L    ${p.config.ip}/32 is directly connected, ${p.name}`);
      }
      for(const route of device.config.staticRoutes||[]){
        const transit=ports.filter(p=>p.up&&simulator.ipv4(p.config.ip)&&simulator.mask(p.config.mask)).find(p=>simulator.sameSubnet(simulator.ipv4(route.nextHop),simulator.ipv4(p.config.ip),simulator.mask(p.config.mask))&&route.nextHop!==p.config.ip);
        output.push(`S${transit&&route.destination==='0.0.0.0'&&route.mask==='0.0.0.0'?'*':' '}   ${simulator.prefix(simulator.ipv4(route.destination),simulator.mask(route.mask))} [1/0] via ${route.nextHop}${transit?`, ${transit.name}`:' (next hop inalcançável)'}`);
      }
    } else if (command === 'show ip nat translations') {
      output.push('Pro  Inside global       Inside local        Outside global');
      const learned=(tables(state).nat||[]).filter(row=>row.routerId===device.id);
      learned.forEach(row=>output.push(`${row.protocol.padEnd(5)}${`${row.insideGlobal}:${row.translatedId}`.padEnd(20)}${`${row.insideLocal}:${row.originalId}`.padEnd(20)}${row.outsideGlobal}`));
      if(!learned.length)output.push('Nenhuma tradução dinâmica até o evento selecionado.');
    } else if (command === 'show ip nat statistics') {
      const nat=device.config.nat, learned=(tables(state).nat||[]).filter(row=>row.routerId===device.id);
      output.push(`Inside interfaces: ${nat?.inside?name(device,`${device.id}:${nat.inside}`):'não configurada'}`,
        `Outside interfaces: ${nat?.outside?name(device,`${device.id}:${nat.outside}`):'não configurada'}`,
        `Source NAT/PAT: ${nat?.enabled?'ativo':'inativo'}${nat?.sourceNetwork&&nat?.sourceMask?` · ${simulator.prefix(simulator.ipv4(nat.sourceNetwork),simulator.mask(nat.sourceMask))}`:''}`,
        `Dynamic translations: ${learned.length}`);
    } else if (command === 'show arp') {
      output.push('Protocol  Address          Age (min)  Hardware Addr   Type  Interface');
      if (device.type === 'router') {
        ports.filter(p => p.up && simulator.ipv4(p.config.ip)).forEach(p => output.push(`Internet  ${p.config.ip.padEnd(17)} -          ${mac(p.config.mac).padEnd(15)} ARPA  ${p.name}`));
        tables(state).arp.filter(r => r.owner === device.id && device.interfaces.includes(r.interfaceId)).forEach(r => output.push(`Internet  ${r.ip.padEnd(17)} 0          ${mac(r.mac).padEnd(15)} ARPA  ${name(device, r.interfaceId)}`));
      }
      output.push(device.type === 'switch' ? 'Switch L2 sem interface IP/SVI: não mantém cache ARP nesta bancada.' : 'Associações dinâmicas até o evento selecionado; “-” identifica endereço local.');
    } else if (command === 'show running-config') {
      output.push('Building configuration...', '!', `hostname ${device.name}`, '!');
      if (device.type === 'switch') [...new Set([...Object.values(device.config.vlans), ...device.config.allowedVlans])].sort((a,b)=>a-b).forEach(v => output.push(`vlan ${v}`, ` name VLAN${String(v).padStart(4,'0')}`, '!'));
      else output.push('ip routing', '!');
      ports.forEach(p => {
        output.push(`interface ${p.name}`);
        const setting=device.config.portSettings?.[p.id]||{};
        if(setting.description)output.push(` description ${setting.description}`);
        if (device.type === 'router') {
          output.push(p.config.ip ? ` ip address ${p.config.ip} ${p.config.mask}` : ' no ip address');
          if(device.config.nat?.inside===p.id.split(':').at(-1))output.push(' ip nat inside');
          if(device.config.nat?.outside===p.id.split(':').at(-1))output.push(' ip nat outside');
        }
        else if (p.mode === 'trunk') output.push(' switchport mode trunk', ` switchport trunk allowed vlan ${device.config.allowedVlans.join(',') || 'none'}`);
        else output.push(' switchport mode access', ` switchport access vlan ${device.config.vlans[p.id]}`);
        output.push(setting.shutdown?' shutdown':' no shutdown', '!');
      });
      if(device.type==='router')(device.config.staticRoutes||[]).forEach(route=>output.push(`ip route ${route.destination} ${route.mask} ${route.nextHop}`));
      if(device.type==='router'&&device.config.nat?.sourceNetwork&&device.config.nat?.sourceMask){
        const network=device.config.nat.sourceNetwork,mask=device.config.nat.sourceMask;
        const wildcard=simulator.mask(mask).map(byte=>255-byte).join('.');
        output.push(`access-list 1 permit ${network} ${wildcard}`);
        if(device.config.nat.enabled&&device.config.nat.outside)output.push(`ip nat inside source list 1 interface ${name(device,`${device.id}:${device.config.nat.outside}`)} overload`);
      }
      output.push('end', 'Configuração representada pela bancada; cabo desconectado não significa shutdown.');
    }
    return {output};
  }
  const syntaxError = detail => ({code:'invalid-input',message:`% Comando inválido neste modo/configuração. ${detail}`});
  const change=(model,updated,output=[])=>updated.error?{error:syntaxError(updated.error)}:{bench:updated.state,output};
  function help(type,mode,context,prefix=[]) {
    let all=['exit','?'];
    if(mode==='exec')all.push('help','clear','enable','ping <ip>',...(type==='router'?['traceroute <ip>']:[]),...showCommands[type].filter(c=>c!=='show running-config'));
    if(mode==='privileged')all.push('help','clear','disable','configure terminal','ping <ip>',...(type==='router'?['traceroute <ip>']:[]),...showCommands[type]);
    if(mode==='config')all.push('help','end','hostname <nome>','interface <interface>',...(type==='router'?['ip route <network> <mask> <next-hop>','no ip route <network> <mask> <next-hop>','access-list 1 permit <rede> <wildcard>','ip nat inside source list 1 interface <interface> overload','no ip nat inside source list 1 interface <interface> overload']:[]));
    if(mode==='config-if')all.push('end','exit','description <texto>','shutdown','no shutdown',...(type==='switch'?['switchport mode access','switchport access vlan <id>','switchport mode trunk','switchport trunk allowed vlan <lista>']:['ip address <ip> <mask>','no ip address','ip nat inside','ip nat outside','no ip nat inside','no ip nat outside']));
    prefix=prefix.filter(token=>token!=='?');
    return all.filter(c=>prefix.every((token,i)=>c.split(' ')[i]?.toLowerCase()===token.toLowerCase()));
  }
  function configGlobal(args,mode,device,labState,model) {
    const words=args.map(word=>word.toLowerCase());
    if(mode==='privileged'&&words.at(-1)==='?'&&words[0]==='terminal')return {output:['terminal']};
    if(mode==='privileged'&&words.join(' ')==='terminal')return {mode:'config',context:{deviceId:device.id},output:[]};
    if(mode==='config'&&words[0]==='interface'&&args.at(-1)==='?')return {output:device.interfaces.map(port=>name(device,port))};
    if(mode==='config'&&words[0]==='interface'&&args.length===2) {
      const id=device.interfaces.find(port=>name(device,port).toLowerCase()===args[1].toLowerCase());
      if(!id)return {error:syntaxError(`Interface desconhecida. Opções: ${device.interfaces.map(port=>name(device,port)).join(', ')}.`)};
      return {mode:'config-if',context:{deviceId:device.id,interfaceId:id},output:[]};
    }
    if(mode==='config'&&words[0]==='hostname'&&args.length===2&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/.test(args[1])) {
      const updated=model.renameDevice(labState,device.id,args[1]);return change(model,updated,[`Hostname alterado para ${args[1]}.`]);
    }
    if(mode==='config'&&device.type==='router'&&words[0]==='ip'&&words[1]==='route'&&args.length===5)
      return change(model,model.setStaticRoute(labState,device.id,{destination:args[2],mask:args[3],nextHop:args[4]}));
    if(mode==='config'&&device.type==='router'&&words[0]==='no'&&words[1]==='ip'&&words[2]==='route'&&args.length===6)
      return change(model,model.removeStaticRoute(labState,device.id,args[3],args[4]));
    if(mode==='config'&&device.type==='router'&&words[0]==='access-list'&&args.length===5&&args[1]==='1'&&words[2]==='permit') {
      const wildcard=simulator.ipv4(args[4]);if(!simulator.ipv4(args[3])||!wildcard)return {error:syntaxError('Use access-list 1 permit <rede> <wildcard>.')};
      const sourceMask=wildcard.map(byte=>255-byte).join('.'),sourceNetwork=args[3];
      return change(model,model.setNat(labState,device.id,{sourceNetwork,sourceMask}));
    }
    if(mode==='config'&&device.type==='router'&&words[0]==='ip'&&words.slice(1,5).join(' ')==='nat inside source list'&&args[5]==='1'&&words[6]==='interface'&&words[8]==='overload'&&args.length===9) {
      const id=device.interfaces.find(port=>name(device,port).toLowerCase()===args[7].toLowerCase());
      if(!id)return {error:syntaxError('Interface outside desconhecida.')};
      return change(model,model.setNat(labState,device.id,{outside:id.split(':').at(-1),enabled:true}));
    }
    if(mode==='config'&&device.type==='router'&&words.slice(0,6).join(' ')==='no ip nat inside source list'&&args[6]==='1'&&words[7]==='interface'&&words[9]==='overload'&&args.length===10)
      return change(model,model.setNat(labState,device.id,{enabled:false}));
    return {error:syntaxError('Use hostname <nome> ou interface <interface>.')};
  }
  function configInterface(args,mode,device,session,labState,model) {
    const id=session.context?.interfaceId;
    if(!id||!device.interfaces.includes(id))return {error:{code:'invalid-context',message:'% Entre em uma interface com o comando interface.'}};
    if(device.type==='switch') return switchCLI.configure(labState,device,id,args);
    const w=args.map(x=>x.toLowerCase());
    const setPort=(key,value)=>change(model,model.configure(labState,device.id,{portSettings:{[id]:{[key]:value}}}));
    if(w.join(' ')==='shutdown')return setPort('shutdown',true);
    if(w.join(' ')==='no shutdown')return setPort('shutdown',false);
    if(w[0]==='description'&&args.length>1){const d=args.slice(1).join(' ');if(d.length>240)return {error:syntaxError('Description aceita até 240 caracteres.')};return setPort('description',d);}
    if(device.type==='router'&&w[0]==='ip'&&w[1]==='address'&&args.length===4){const ip=args[2],mask=args[3];if(!simulator.ipv4(ip)||!simulator.mask(mask))return {error:syntaxError('Informe IPv4 e máscara contígua válidos.')};const key=id.endsWith(':eth0')?'eth0':'eth1';return change(model,model.configure(labState,device.id,{[key]:{ip,mask}}));}
    if(device.type==='router'&&w.join(' ')==='no ip address'){const key=id.endsWith(':eth0')?'eth0':'eth1';return change(model,model.configure(labState,device.id,{[key]:{ip:'',mask:''}}));}
    if(device.type==='router'&&['ip nat inside','ip nat outside','no ip nat inside','no ip nat outside'].includes(w.join(' '))) {
      const role=w.at(-1),key=id.split(':').at(-1),current=device.config.nat||{};
      return change(model,model.setNat(labState,device.id,{[role]:w[0]==='no'?(current[role]===key?'':current[role]):key}));
    }
    return {error:syntaxError(`Comando não suportado para ${device.type} neste modo de interface.`)};
  }
  function install(registry) {
    const model=getModel();
    for(const type of ['switch','router']) {
      const register=command=>registry.register(type,'cisco-ios',command);
      register({name:'enable',description:'Entrar no modo EXEC privilegiado.',modes:['exec','privileged'],execute:()=>({mode:'privileged',output:[]})});
      register({name:'disable',description:'Voltar ao modo EXEC usuário.',modes:['privileged'],execute:({session})=>({mode:'exec',context:{deviceId:session.deviceId},output:[]})});
      register({name:'configure',description:'Acessar a configuração global.',modes:['privileged'],acceptsArguments:true,execute:({args,device,labState})=>configGlobal(args,'privileged',device,labState,model)});
      register({name:'end',description:'Sair dos modos de configuração.',modes:['config','config-if'],execute:({session})=>({mode:'privileged',context:{deviceId:session.deviceId},output:[]})});
      register({name:'exit',description:'Subir um nível ou encerrar a sessão.',modes:['exec','privileged','config','config-if'],execute:({session})=>session.mode==='config-if'?{mode:'config',context:{deviceId:session.deviceId},output:[]}:session.mode==='config'?{mode:'privileged',context:{deviceId:session.deviceId},output:[]}:session.mode==='privileged'?{mode:'exec',context:{deviceId:session.deviceId},output:[]}:{closed:true,output:['Sessão encerrada.']}});
      register({name:'hostname',description:'Definir o nome do equipamento.',modes:['config'],acceptsArguments:true,execute:({args,device,labState})=>configGlobal(['hostname',...args],'config',device,labState,model)});
      register({name:'interface',description:'Selecionar uma interface.',modes:['config'],acceptsArguments:true,execute:({args,device,labState})=>configGlobal(['interface',...args],'config',device,labState,model)});
      register({name:'switchport',description:'Configurar VLAN e modo da porta.',modes:['config-if'],acceptsArguments:true,execute:({args,device,session,labState})=>args[0]==='?'?{output:['mode access','access vlan <id>','mode trunk','trunk allowed vlan <lista>']}:configInterface(['switchport',...args],session.mode,device,session,labState,model)});
      register({name:'shutdown',description:'Desabilitar administrativamente a interface.',modes:['config-if'],execute:({device,session,labState})=>configInterface(['shutdown'],'config-if',device,session,labState,model)});
      register({name:'no',description:'Remover ou reverter configuração.',modes:['config','config-if'],acceptsArguments:true,execute:({args,device,session,labState})=>session.mode==='config'?configGlobal(['no',...args],'config',device,labState,model):configInterface(['no',...args],'config-if',device,session,labState,model)});
      register({name:'description',description:'Descrever a interface.',modes:['config-if'],acceptsArguments:true,execute:({args,device,session,labState})=>configInterface(['description',...args],'config-if',device,session,labState,model)});
      register({name:'ip',description:'Configurar IPv4 e rotas do roteador.',modes:['config','config-if'],acceptsArguments:true,execute:({args,device,session,labState})=>session.mode==='config'?configGlobal(['ip',...args],'config',device,labState,model):configInterface(['ip',...args],'config-if',device,session,labState,model)});
      if(type==='router')register({name:'access-list',description:'Definir a rede inside para PAT educacional.',modes:['config'],acceptsArguments:true,execute:({args,device,labState})=>configGlobal(['access-list',...args],'config',device,labState,model)});
      register({name:'ping',description:'Enviar ICMP Echo Request e observar o retorno na bancada.',modes:['exec','privileged'],acceptsArguments:true,execute:({args,device,labState})=>{
        if(args.length!==1||!simulator.ipv4(args[0]))return {error:syntaxError('Use ping <IPv4>.')};
        if(device.type==='switch')return {error:{code:'no-ip-interface',message:'% Este switch L2 não possui interface IP/SVI para originar ICMP na bancada.'}};
        const adapted=model.adaptForPing(labState,device.id);
        if(adapted.error)return {error:{code:'configuration-error',message:`% ${adapted.error}`}};
        const result=simulator.ping(adapted.input,args[0]);
        const symbol={reply:'!',timeout:'.','destination-unreachable':'U','ttl-expired':'T',interrupted:'?'}[result.status]||'?';
        return {labResult:result,output:[`Sending 1 ICMP Echo to ${args[0]}: ${symbol}`,
          result.status==='reply'?'Success rate is 100 percent (1/1); RTT não modelado.':`Success rate is 0 percent (0/1). ${result.message}`]};
      }});
      if(type==='router')register({name:'traceroute',description:'Observar saltos com sondas ICMP de TTL crescente.',modes:['exec','privileged'],acceptsArguments:true,execute:({args,device,labState})=>{
        if(args.length!==1||!simulator.ipv4(args[0]))return {error:syntaxError('Use traceroute <IPv4>.')};
        const adapted=model.adaptForPing(labState,device.id);
        if(adapted.error)return {error:{code:'configuration-error',message:`% ${adapted.error}`}};
        const result=simulator.traceroute(adapted.input,args[0]);
        return {labResult:result,output:[`Tracing route to ${args[0]} (ICMP; até 12 saltos)`,
          ...result.hops.map(hop=>`${String(hop.ttl).padStart(2)}  ${hop.address||'*'}  ${hop.response}`),result.message,'RTT não modelado.']};
      }});
      register({name:'?',description:'Listar comandos válidos no modo atual.',modes:['exec','privileged','config','config-if'],execute:({session})=>({output:help(type,session.mode,session.context)})});
      register({name:'help',description:'Listar comandos disponíveis.',modes:['exec','privileged','config','config-if'],execute:({session})=>({output:help(type,session.mode,session.context)})});
      register({name:'show',description:'Consultar estado real da bancada.',modes:['exec','privileged'],acceptsArguments:true,execute:({session,args,device,labState})=>{
        const tokens=args.map(a=>a.toLowerCase());
        if(!tokens.length||tokens.at(-1)==='?')return {output:help(type,session.mode,session.context,['show',...tokens])};
        const cmd=['show',...tokens].join(' ');
        if(!showCommands[type].includes(cmd))return {error:{code:'invalid-input',message:'% Comando de consulta inválido. Use show ?.'}};
        if(cmd==='show running-config'&&session.mode!=='privileged')return {error:{code:'wrong-mode',message:'% Use enable para consultar running-config.'}};
        return show(cmd,device,labState);
      }});
    }
  }
  return Object.freeze({install});
});
