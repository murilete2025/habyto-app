# Documentação do Projeto: Aplicativo de Jejum & Emagrecimento

> **Aviso para o Próximo Agente de IA:** 
> Leia este documento com atenção. Ele descreve toda a estrutura, stack tecnológica, o que já foi finalizado e os próximos passos deste ecossistema.

---

## 📌 1. Visão Geral do Projeto
Este projeto consiste em uma estrutura completa de Venda e Entrega de um produto digital focado em Emagrecimento através do **Jejum Intermitente**. 

O objetivo é imitar a experiência premium de aplicativos globais (como Unimeal/Lasta), mas usando uma fundação leve e de rápida iteração.

O ecossistema divide-se em dois diretórios locais:
- `/funil-jejum` (Frontend de Vendas - Aquisição)
- `/app-entregavel` (Área Restrita do Cliente - O Produto Real)

---

## 🛠 2. Stack Tecnológica Atual
* **Frontend:** HTML5, CSS3, e Vanilla JavaScript (Módulos). Nenhum framework pesado foi usado ainda para manter simplicidade estática. Estilos customizados mobile-first e responsivos. Design System focado nas cores primárias "Teal" (`#1a9e8e`) e Branco.
* **Backend de Autenticação/Dados:** Google Firebase (Authentication via E-mail/Senha e Firestore Database).
* **Backend de IA (Provisório local):** Python (`server.py`) com módulo nativo `http.server`.
* **Motor de Inteligência Artificial:** API da OpenAI (Endpoint `v1/chat/completions`) utilizando o modelo GPT para geração em formato JSON estrito.

---

## 🚀 3. O que já foi FEITO e ESTÁ PRONTO

### A) O Funil de Vendas (`/funil-jejum`)
Trata-se de um Single Page Application (SPA) contendo um Quiz dinâmico com 37 passos lógicos.
* **Mecânica:** Arquivo `app.js` escuta os cliques, atualiza um objeto `state` e troca de tela removendo a classe CSS `.active`.
* **Design Finalizado:** Imagens de avatares fictícios carregando, mapas dinâmicos, comparativo de corpos e barra de carregamento artificial simulando análise de plano.
* **Página Final (Pricing):** Exibe o resultado personalizado (falso e motivacional) e o botão de pagamento da oferta.

### B) O Aplicativo Entregável (`/app-entregavel`)
Trata-se do produto de fato (Pós-venda).
1. **Autenticação Concluída:** Tela de Login e Criação de Conta utilizando Firebase. Se o usuário estiver deslogado, as páginas são bloqueadas.
2. **Dashboard de Jejum:** Cronômetro circular de jejum "16 horas". O momento do clique é salvo no Firebase (`fastStartTime`), permitindo que a conta não se perca se fechar e abrir o navegador.
3. **Rastreador de Água:** 8 gotas de água diárias interativas salvas no Firestore (`waterGlasses`).
4. **Inteligência Artificial (Geração do Plano):** 
   - Ao lado do timer, há um botão "Gerar Meu Plano de Hoje".
   - O App faz um Fetch POST para o `/api/generate`.
   - O `server.py` (Python) intercepta o POST, assina um prompt de Nutricionista/Personal Trainer injetando a chave da OpenAI (`OPENAI_API_KEY`) e pede um JSON de volta.
   - O App pega o JSON de café, almoço, janta e exercícios e injeta via DOM Dinâmico (JS) na tela do usuário.

---

## 🚧 4. O que AINDA FALTA SER FEITO (Próximos Passos)

Se você, Agente de IA, for continuar este projeto a partir de agora, foque nestas pendências:

### 1) Hospedagem / Deploy
O aplicativo inteiro roda atualmente via host python de porta local. Precisamos colocá-lo no ar (ex: hospedagem na plataforma **Vercel**).

### 2) Vercel Serverless Function (Substituir o Python)
Como o Vercel hospeda sites estáticos (HTML/JS), não é ideal subir o nosso arquivo local `server.py` para hospedar o backend. 
- **Ação Necessária:** O Agente deve reconstruir o `/api/generate` em **Node.js Serverless Function (Ex: criar uma pasta `/api` na raiz e usar roteamento do próprio Vercel)**.
- Essa função segura a chave escondida da OpenAI como "Environment Variable", executa a requisição, e retorna para o nosso `app.js` front-end. 

### 3) Links de Checkout no Funil
Os botões finais da página de preços do `/funil-jejum/index.html` possuem `href="#"`.
- **Ação Necessária:** Substituir pelo link real do checkout da plataforma selecionada (Kiwify, Hotmart, PerfectPay).

### 4) Transporte de Dados do Funil para o App
No funil de vendas, o cliente responde o seu peso, alergias, e qual seu objetivo. No momento, o App gera o cardápio sem conhecer profundamente esses detalhes.
- **Ação (Futuro Opcional Avançado):** Via webhook na plataforma de pagamento, ou parâmetros de URL (`?peso=75`), passar a preferência física do cliente na hora do cadastro no Firebase, de forma que o script IA pegue essas variáveis no banco de dados para injetar no Prompt dinâmico de nutrição.
