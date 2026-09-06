# 🚀 Guia de Publicação 24/7 na Nuvem - FocoGentil SaaS V2

Este guia ensina o passo a passo simplificado para colocar o **FocoGentil** no ar **24 horas por dia, 7 dias por semana**, com link fixo e seguro (HTTPS), sem depender do seu computador estar ligado.

Recomendamos a plataforma **Render.com** (plano gratuito disponível, certificado SSL automático e suporte nativo a Node.js).

---

## 📦 Opção Mais Rápida: Subir via GitHub + Render (3 Minutos)

### Passo 1: Criar o Repositório no GitHub
1. Acesse [github.com](https://github.com) e faça login (ou crie uma conta gratuita).
2. Clique no botão verde **New** (Novo repositório).
3. Dê o nome de **ocogentil-saas** e escolha **Privado** ou **Público**.
4. Não marque nenhuma opção extra (como README ou gitignore). Clique em **Create repository**.
5. Na página que abrir, clique em **uploading an existing file** (ou envie os arquivos da pasta descompactada de FOCOGENTIL_NUVEM_PRONTO.zip que colocamos na sua Área de Trabalho).
6. Arraste todos os arquivos do projeto para o GitHub e clique em **Commit changes**.

---

### Passo 2: Publicar no Render.com
1. Acesse [render.com](https://render.com) e crie sua conta (pode entrar direto com seu GitHub).
2. No painel inicial (Dashboard), clique em **New +** no canto superior direito e escolha **Web Service**.
3. Selecione a opção **Build and deploy from a Git repository** e clique em **Next**.
4. Conecte sua conta do GitHub e selecione o repositório **ocogentil-saas**.
5. Preencha os campos (ou o Render já preencherá automaticamente pelo ender.yaml):
   - **Name:** ocogentil
   - **Region:** Ohio (US East) ou Oregon
   - **Branch:** main
   - **Runtime:** Node
   - **Build Command:** 
pm test
   - **Start Command:** 
ode server.js
   - **Plan Instance:** Free (/mês)
6. Clique no botão azul **Deploy Web Service**.

---

### Passo 3: Seu Link 24/7 está Pronto!
Em cerca de 1 a 2 minutos, o Render exibirá a mensagem de sucesso com a sua URL pública permanente:
👉 **https://focogentil.onrender.com** (ou nome similar)

Todas as rotas funcionarão 24/7:
- **📱 App Copiloto:** https://focogentil.onrender.com/app
- **🌐 Landing Page:** https://focogentil.onrender.com/
- **🛡️ Painel Admin:** https://focogentil.onrender.com/admin
- **💚 Health Check:** https://focogentil.onrender.com/api/health

---

## ⚡ Dica de Ouro: Como manter a Nuvem Gratuita 100% Acordada
Os servidores gratuitos do Render entram em modo de repouso (sleep) se passarem 15 minutos sem visitas, e demoram cerca de 30 segundos para acordar quando alguém acessa.

Para mantê-lo **100% acordado e instantâneo 24 horas por dia sem gastar nada**:
1. Crie uma conta gratuita no [uptimerobot.com](https://uptimerobot.com).
2. Clique em **Add New Monitor**.
3. Monitor Type: **HTTP(s)**
4. Friendly Name: **FocoGentil Health**
5. URL: https://sua-url.onrender.com/api/health
6. Monitoring Interval: **5 minutes** ou **10 minutes**.
Pronto! O UptimeRobot fará uma checagem periódica automática, mantendo seu FocoGentil sempre desperto e pronto para receber clientes a qualquer segundo!

---

## 🌐 Domínio Próprio (Opcional: www.focogentil.com.br)
No Render, você pode conectar gratuitamente o seu domínio próprio:
1. Vá em **Settings** do seu serviço no Render.
2. Na seção **Custom Domains**, clique em **Add Custom Domain**.
3. Digite seu domínio (ex: pp.focogentil.com.br ou ocogentil.com.br).
4. Siga as instruções do DNS (CNAME) fornecidas pelo Render. O certificado SSL HTTPS é emitido de forma automática e gratuita.
