# NetStudy — conceito e documentação de deploy

## Visão do projeto

NetStudy é uma aplicação pessoal e interativa para estudar fundamentos de redes. O objetivo não é funcionar como uma apostila extensa, mas conduzir sessões curtas no fluxo:

```text
LER POUCO
↓
INTERAGIR
↓
RESPONDER
↓
RECEBER EXPLICAÇÃO
↓
RACIOCINAR DE OUTRA FORMA
↓
AVANÇAR
```

O conteúdo é determinístico e escrito previamente. A aplicação não usa IA, APIs de LLM, chat, geração automática de conteúdo ou geração de imagens.

## Conceito pedagógico

Cada módulo apresenta uma pergunta central, constrói um modelo mental com exemplos concretos e oferece interações simples antes do checkpoint. Os erros são tratados como oportunidades de aprendizagem: o feedback explica a decisão sem depender apenas de cores e registra se a resolução ocorreu imediatamente ou com orientação.

Os checkpoints mantêm na sessão Django:

- atividade atual;
- respostas e tentativas;
- resultado imediato ou guiado;
- misconceptions identificadas;
- conclusão do checkpoint.

Não existem contas de usuário, pontuação, pagamentos ou histórico permanente. O reset das demonstrações e atividades acontece sem recarregar a página.

## Conteúdos disponíveis

1. ARP
2. MAC Address
3. Frame Ethernet
4. Switch Ethernet e tabela MAC
5. Unicast × Broadcast
6. VLAN e portas Access
7. Trunk + 802.1Q
8. IPv4 + Sub-rede
9. Default Gateway + Next Hop
10. Tabela de Rotas e escolha de caminho
11. Inter-VLAN Routing
12. ICMP + Ping + Traceroute
13. TCP × UDP

O módulo seguinte planejado é **Portas + Cliente/Servidor**.

## Arquitetura

```text
NetStudy/
├── manage.py
├── requirements.txt
├── netstudy/                  # Configuração Django, URLs e WSGI
├── learning/                  # Views, conteúdo estruturado e testes
├── templates/learning/        # Páginas e componentes Django Templates
└── static/
    ├── css/                   # Estilos próprios complementares
    ├── js/                    # Interações determinísticas sem frameworks
    └── images/                # Imagens externas usadas pelo conteúdo
```

Tecnologias atuais:

- Python 3.11 ou mais recente;
- Django 5.2;
- SQLite;
- Django Templates;
- Bootstrap 5;
- JavaScript e CSS próprios, sem framework de frontend.

## Execução local no Windows

No PowerShell:

```powershell
git clone https://github.com/Gabriel-J-Oliveira/netstudy.git
cd netstudy
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

A aplicação ficará disponível em `http://127.0.0.1:8000/`.

Se a política do PowerShell impedir a ativação do ambiente, os comandos podem usar diretamente `.\.venv\Scripts\python.exe`, por exemplo:

```powershell
.\.venv\Scripts\python.exe manage.py runserver
```

## Verificação antes de publicar

```powershell
python manage.py check
python manage.py test
```

O banco `db.sqlite3`, o ambiente `.venv` e arquivos `.env` são locais e não devem ser versionados.

## Estado atual de deploy

A configuração presente em `netstudy/settings.py` é deliberadamente voltada ao desenvolvimento local:

- `DEBUG = True`;
- chave de desenvolvimento local;
- `ALLOWED_HOSTS` vazio;
- servidor iniciado por `runserver`;
- arquivos estáticos servidos no fluxo de desenvolvimento;
- SQLite como banco local.

Portanto, clonar e executar localmente é suportado agora. Uma publicação em servidor acessível pela internet exige a preparação descrita abaixo.

## Preparação para produção

Antes de expor o projeto publicamente:

1. carregar `SECRET_KEY` de variável de ambiente ou serviço de segredos;
2. definir `DEBUG=False`;
3. configurar explicitamente `ALLOWED_HOSTS` e, quando necessário, `CSRF_TRUSTED_ORIGINS`;
4. executar `python manage.py check --deploy` e resolver os avisos aplicáveis;
5. definir `STATIC_ROOT` e executar `python manage.py collectstatic`;
6. usar um servidor WSGI de produção compatível com a plataforma escolhida, em vez de `runserver`;
7. colocar a aplicação atrás de HTTPS e configurar corretamente cookies e cabeçalhos de segurança;
8. executar migrations durante a publicação;
9. decidir se SQLite atende ao ambiente de uso único ou se será necessário um banco gerenciado;
10. manter arquivos `.env`, credenciais, banco local e ambiente virtual fora do Git.

Exemplo conceitual de variáveis esperadas para uma futura configuração de produção:

```text
DJANGO_SECRET_KEY=<segredo fornecido pela plataforma>
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=netstudy.exemplo.com
```

Essas variáveis ainda precisam ser lidas por `settings.py` antes de um deploy real. Nenhum segredo verdadeiro deve ser colocado no repositório.

## Fluxo conceitual de publicação

```text
Código versionado no GitHub
↓
Ambiente instala requirements.txt
↓
Variáveis de ambiente são configuradas
↓
Migrations são executadas
↓
Arquivos estáticos são coletados
↓
Servidor WSGI inicia netstudy.wsgi
↓
Proxy HTTPS publica a aplicação
```

## Limitações deliberadas

- aplicação pessoal, sem multi-tenant;
- sem login ou usuários;
- sem API pública;
- sem pagamentos;
- sem persistência de desempenho;
- sem serviços de IA;
- demonstrações de rede pedagógicas e determinísticas, sem enviar pacotes reais;
- SQLite e configurações atuais destinados ao desenvolvimento local.

## Checklist de uma futura plataforma

Ao escolher uma plataforma de hospedagem, confirmar:

- suporte a Python e WSGI;
- comando de instalação `pip install -r requirements.txt`;
- etapa de release com `python manage.py migrate`;
- suporte a variáveis de ambiente;
- armazenamento adequado ao banco escolhido;
- execução de `collectstatic`;
- domínio e HTTPS;
- logs de aplicação;
- processo de rollback.

Esta documentação descreve o projeto e a fronteira entre a execução local já funcional e os ajustes ainda necessários para um deploy real e seguro.
