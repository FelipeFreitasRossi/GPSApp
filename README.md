# 📍 GPS App – React Native com Expo

![Expo](https://img.shields.io/badge/Expo-React%20Native-blueviolet)
![React](https://img.shields.io/badge/React-Native-61DAFB)
![Status](https://img.shields.io/badge/Status-Em%20Desenvolvimento-yellow)

## 📖 Sobre o Projeto

Este projeto é um **aplicativo de GPS** desenvolvido utilizando **Expo com React Native e TypeScript**, focado em oferecer uma experiência moderna, segura e eficiente de navegação e localização, com maior robustez no código por meio da tipagem estática.

O objetivo principal do projeto é explorar conceitos de **geolocalização**, **interfaces mobile**, **componentização em React** e **boas práticas de desenvolvimento mobile**, servindo tanto como aplicação funcional quanto como projeto de aprendizado e portfólio.

---

## 🚀 Tecnologias Utilizadas

* **React Native** – Desenvolvimento mobile multiplataforma
* **Expo** – Ambiente de desenvolvimento simplificado
* **TypeScript** – Tipagem estática para maior confiabilidade e escalabilidade do código
* **Expo Location** – Acesso à localização do dispositivo com suporte a TypeScript
* **Expo Maps / APIs de Mapas** *(quando aplicável)*

---

## 📱 Funcionalidades

* 📍 Captura da localização atual do usuário
* 🗺️ Exibição de mapas em tempo real
* 📌 Marcação de pontos no mapa
* 🔄 Atualização dinâmica da posição
* 📲 Interface responsiva e intuitiva

> ⚠️ Algumas funcionalidades podem depender de permissões de localização do dispositivo.

---

## 🛠️ Pré-requisitos

Antes de iniciar, certifique-se de ter instalado:

* **Node.js** (versão LTS recomendada)
* **npm** ou **yarn**
* **Expo CLI** (opcional, mas recomendado)
* Um **emulador Android/iOS** ou o app **Expo Go** no celular

---

## ▶️ Como Executar o Projeto

Siga os passos abaixo para rodar o projeto localmente:

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/seu-repositorio.git

# Acesse a pasta do projeto
cd seu-repositorio

# Instale as dependências
npm install

# Inicie o projeto com Expo
npx expo start
```

Após executar o comando acima:

* Pressione **`a`** para abrir no Android
* Pressione **`i`** para abrir no iOS (macOS)
* Ou escaneie o **QR Code** com o app **Expo Go**

---

## 🔐 Permissões

O aplicativo solicita as seguintes permissões:

* 📍 **Localização do dispositivo** – necessária para funcionamento do GPS

Essas permissões são solicitadas automaticamente ao iniciar o app.

---

## 📂 Estrutura do Projeto

```bash
src/
 ├── components/      # Componentes reutilizáveis tipados
 ├── screens/         # Telas do aplicativo
 ├── services/        # Serviços e integrações
 ├── hooks/           # Hooks personalizados
 ├── assets/          # Imagens, ícones e fontes
 └── App.tsx          # Arquivo principal
```

> A estrutura pode variar conforme a evolução do projeto.

---

## 🎯 Próximas Melhorias

* 🧭 Rotas e navegação em tempo real
* 🔍 Busca por endereços
* ⭐ Salvar locais favoritos
* 🌙 Modo escuro
* 🗂️ Histórico de localizações

---

## 🤝 Contribuição

Contribuições são bem-vindas!

1. Faça um **fork** do projeto
2. Crie uma **branch** para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas alterações (`git commit -m 'Adiciona nova feature'`)
4. Faça o **push** (`git push origin feature/nova-feature`)
5. Abra um **Pull Request**

---

## 🧑‍💻 Autor

Desenvolvido por **Felipe Rossi** 👑
Projeto criado para fins educacionais e portfólio.

---

## 📜 Licença

Este projeto está sob a licença **MIT**.
Sinta-se livre para usar, modificar e distribuir.

---

⭐ Se você gostou do projeto, não esqueça de deixar uma estrela no repositório!
