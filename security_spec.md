# Especificação de Segurança - ETP Digital (VIABILIZA)

## Invariantes de Dados
1. Um ETP pertence a um autor (userId) e não pode ter seu autor alterado exceto por um Master.
2. Apenas usuários 'approved' podem realizar operações de escrita (exceto o próprio perfil inicial).
3. Timestamps `createdAt` são imutáveis.
4. O campo `role` de um usuário só pode ser alterado por um Master.

## Dirty Dozen Payloads (Tentativas de Ataque)
1. **Escalação de Privilégio (Self-Promote):** Usuário tenta atualizar seu próprio `role` para 'master' durante o registro.
2. **Injeção de Identidade:** Usuário tenta criar um ETP com o `userId` de outra pessoa.
3. **Sequestro de ETP:** Usuário tenta atualizar um ETP que não lhe pertence.
4. **Atualização Fantasma:** Usuário tenta adicionar campos não permitidos no schema do ETP.
5. **Bypass de Status:** Usuário tenta se marcar como 'approved' sem intervenção do Master.
6. **Poisoning de ID:** Uso de IDs gigantes (1MB) para Document IDs.
7. **Limpeza de Timestamps:** Tentar zerar `createdAt` ou `updatedAt`.
8. **Leitura Indiscreta:** Usuário comum tentando listar a coleção `config/system` (onde está o webhook).
9. **Escrita em Configurações:** Usuário comum tentando alterar o `chatWebhookUrl`.
10. **Acesso por E-mail Não Verificado:** Payload com `email_verified: false` tentando ler dados sensíveis.
11. **Shadow Update em Usuário:** Tentar alterar o `lastActive` de outro usuário.
12. **Deleção em Massa:** Tentar deletar o banco `config/system`.

## Plano de Regras (Fortress Rules)
As regras usarão o padrão "Master Gate" e "Action-Based Update Pattern" com helpers `isValidUser` e `isValidETP`.
