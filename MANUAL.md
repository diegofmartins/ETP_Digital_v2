# Manual do Usuário - VIABILIZA (ETP Digital)

O **VIABILIZA** é uma plataforma de inteligência projetada para auxiliar os servidores da Câmara Municipal de Curitiba (CMC) na elaboração de Estudos Técnicos Preliminares (ETP), integrando as diretrizes da Lei 14.133/2021 com o poder da Inteligência Artificial.

---

## 1. Acesso ao Sistema
1. Acesse o link oficial do projeto.
2. Clique em **"Entrar com Google"**.
3. Utilize seu e-mail institucional (**@cmc.pr.gov.br** ou **@cmc.curitiba.pr.leg.br**).
4. **Primeiro Acesso:** Seu usuário entrará em modo "Pendente". Um administrador (Master) precisará aprovar seu acesso na tela de Administração antes que você possa criar documentos.

## 2. Dashboard (Painel Principal)
No Dashboard, você encontrará:
- **Seus ETPs:** Lista de todos os documentos criados por você.
- **Novo ETP:** Botão para iniciar um novo estudo.
- **Status:** Indica se o documento está "Em Execução" ou "Concluído".
- **Busca:** Filtro rápido por título do ETP.

## 3. Elaboração do ETP
O sistema divide a elaboração em duas grandes etapas:

### A. Diagnóstico Inicial
Nesta fase, você define o nome do projeto e responde a perguntas fundamentais sobre a demanda. A IA utiliza essas respostas para entender o contexto e sugerir os textos técnicos nas etapas seguintes.

### B. Etapa Técnica
Após o diagnóstico, o sistema libera os campos técnicos (Descrição da Solução, Requisitos, Estimativas, Riscos, etc.).
- **Modo Manual:** Você pode digitar os textos normalmente.
- **Modo IA (Sugerir):** Clique no ícone da **Varinha Mágica** 🪄 ao lado de qualquer campo para que a IA gere uma sugestão baseada no seu diagnóstico.
- **Refinar:** Se você já escreveu algo, a IA pode ajudar a melhorar a redação técnica.

## 4. Ferramentas Inteligentes
- **Geração Global:** No topo da tela de edição, você encontrará a opção de "Assistente de Geração Completa". Ele pode sugerir textos para todos os campos vazios de uma só vez.
- **Diagnóstico de Consistência:** O sistema verifica se os campos obrigatórios foram preenchidos antes de permitir a conclusão.

## 5. Exportação e Impressão
- **DOCX:** Exporta o ETP formatado em arquivo do Word (.docx), pronto para ser inserido nos sistemas de processo eletrônico.
- **Imprimir:** Gera uma versão para impressão ou salvamento em PDF diretamente pelo navegador.

## 6. Administração (Apenas Usuários Master)
Usuários com perfil "Master" têm ferramentas adicionais:
- **Gestão de Usuários:** Aprovar novos servidores, alterar cargos (Servidor vs Master) ou bloquear acessos.
- **Gestão de Documentos:** Visualizar todos os ETPs da casa, restaurar documentos da lixeira ou reatribuir a propriedade de um ETP (trocar o autor).
- **Lixeira:** Recuperar documentos excluídos acidentalmente por até 24 horas.
- **Notificações:** O sistema está configurado para avisar o administrador Master via Google Chat sempre que um novo usuário solicitar acesso ou um novo ETP for criado. Esta funcionalidade requer a configuração da URL do Webhook nas configurações de ambiente do sistema (`VITE_GOOGLE_CHAT_WEBHOOK_URL`).

---

## 7. Suporte e Erros
Caso encontre uma **página em branco** ou erro de **permissão**:
1. Verifique se o seu e-mail foi aprovado na Administração.
2. Recarregue a página (F5 ou Ctrl+R).
3. Limpe o cache do navegador se o problema persistir.

**Versão do Sistema:** 2.4.1
**Câmara Municipal de Curitiba**
