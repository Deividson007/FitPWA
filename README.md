# FitFlow — PWA de treinos em React

Aplicação **100% frontend**, sem API ou backend, feita com React + Vite. Os dados de cada navegador são um banco **SQLite real**, executado com `sql.js` (SQLite em WebAssembly), serializado para **IndexedDB** após cada transação. O cache do Service Worker permite executar o app offline após a primeira visita online. O servidor Docker entrega apenas os arquivos estáticos.

## Funcionalidades

- Perfil individual: nome, idade, peso inicial e objetivo.
- CRUD de exercícios: nome, grupo muscular, categoria, modo e descrição.
- Histórico de peso: registro, edição, exclusão e gráfico.
- Treinos: nível, rodadas, descanso entre rodadas, sequência ordenável, séries, repetições, tempo por série, carga e descanso entre séries/exercícios.
- Execução: preparação, cronômetro regressivo, pausa, próximo passo, descanso automático, alarmes via Web Audio, tentativa de Wake Lock e histórico das sessões e cargas.
- Dashboard e análises: frequência, sequência de dias, duração total, média nos dias ativos, atividade semanal/mensal, cargas e peso.
- Tema claro e escuro, layout responsivo e instalável como PWA.
- Exportação de backup `.sqlite` e restauração local.

## Desenvolvimento

Requer Node.js 20+ e npm:

```bash
npm install
npm run dev
```

Abrir `http://localhost:5173`. Para validar a versão de produção:

```bash
npm run build
npm run preview
```

**O app não requer serviço SQLite na stack.** O SQLite é carregado pelo navegador e seu binário WASM faz parte dos arquivos da PWA. O banco é persistido localmente em IndexedDB e exportável como `.sqlite`.

## Docker Swarm / Portainer

1. Ajuste o registry de sua organização e construa a imagem (o build requer acesso ao npm):

```bash
docker build -t registry.seudominio.com/fitflow:1.0.0 .
docker push registry.seudominio.com/fitflow:1.0.0
```

2. Edite `docker-stack.yml`: imagem, domínio HTTPS, nome da rede Traefik e entrypoint; depois cole em **Portainer → Stacks → Add stack**.
3. Configure DNS e TLS para o domínio escolhido; instale a PWA pelo navegador.
4. Abra o app online uma vez, depois teste com modo avião. Em outro navegador ou dispositivo, o banco será diferente.

Se você não usa Traefik, substitua os labels pela configuração de proxy do seu ambiente. O YAML fornecido é um exemplo de Swarm, não contém certificados nem registry funcional.

## Cuidados de uso

- O aplicativo **não sincroniza** dados entre dispositivos: use Configurações → Exportar SQLite para backup.
- Limpar dados do site ou desinstalar o navegador pode apagar IndexedDB.
- Alarmes em background e Wake Lock não são garantidos em todas as versões de Android/iOS. Deixe o app visível e a tela ativa durante o treino.
- Séries com repetições também usam duração (em segundos) para permitir o cronômetro automático; configure o tempo estimado da série.
- As estatísticas de tempo diário representam **média por dia com atividade**, não incluem dias sem treino.
- A data do peso inicial no perfil não é uma pesagem; use a tela Peso para criar o primeiro registro histórico.

## Dados e arquitetura

`src/lib/db.js` contém esquema SQL e persistência IndexedDB. As nove tabelas são: `profile`, `exercises`, `weights`, `workouts`, `workout_items`, `sessions`, `session_exercises`, `load_history` e `settings`.

## Validação

Confira, nesta ordem:
1. Cadastro de perfil e troca de tema.
2. Exercícios: criar, editar e remover.
3. Pesos: registrar e recarregar.
4. Montar um treino com dois exercícios, múltiplas séries e rodadas.
5. Executar treino até o fim, testar alarme, pausa e descanso.
6. Conferir histórico no Dashboard e Análises.
7. Exportar arquivo SQLite e testar restauração (de preferência em navegador de teste).
8. Desligar a internet após o primeiro acesso e recarregar a PWA.

**Nota de entrega:** a geração neste ambiente não permitiu acessar o registry npm para concluir `npm install`/`npm run build`. Os arquivos foram criados, mas o build em seu ambiente precisa ser a validação final.
