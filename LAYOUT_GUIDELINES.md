# 🎨 VeloHub - Guia de Layout e Design
<!-- VERSION: v1.1.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team -->

## 🎯 **Paleta Oficial de Cores**

### **CORES PRINCIPAIS**
```css
--white: #F3F7FC        /* Tom de branco */
--gray: #272A30         /* Cinza */
--blue-dark: #000058    /* Azul Escuro */
--blue-medium: #1634FF  /* Azul Médio */
--blue-light: #1694FF   /* Azul Claro */
```

### **CORES SECUNDÁRIAS**
```css
--blue-opaque: #006AB9  /* Azul Opaco */
--yellow: #FCC200       /* Amarelo */
--green: #15A237        /* Verde */
```

### **CORES DE FUNDO E CONTAINERS para temas CLAROS**
```css
--cor-fundo: #f0f4f8        /* Fundo principal da aplicação */
--cor-container: #F3F7FC     /* Container principal - BRANCO PADRONIZADO */
--cor-card: #F3F7FC         /* Fundo dos cards - BRANCO PADRONIZADO */
--cor-header #F3F7FC     /*  BRANCO PADRONIZADO */
```
---

## 🔤 **Tipografia**

### **Fontes Oficiais**
```css
/* Fonte principal - Referência ao logo Velotax */
font-family: 'Poppins', sans-serif;

/* Fonte secundária - Textos menores */
font-family: 'Anton', sans-serif;
```

### **Hierarquia de Textos**
```css
/* Títulos principais */
font-family: 'Poppins', sans-serif;
font-weight: 700;
font-size: 2rem; /* 32px */

/* Subtítulos */
font-family: 'Poppins', sans-serif;
font-weight: 600;
font-size: 1.5rem; /* 24px */

/* Texto do corpo */
font-family: 'Poppins', sans-serif;
font-weight: 400;
font-size: 1rem; /* 16px */

/* Textos menores */
font-family: 'Anton', sans-serif;
font-weight: 400;
font-size: 0.875rem; /* 14px */
```

---

## 📦 **Containers e Estrutura**

### **Container Principal (Destacado)**
```css
.container-main {
  background-color: var(: #F3F7FC);
  border-radius: 12px;           /* Quinas arredondadas */
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); /* Sombreado para destacamento */
  padding: 24px;
  margin: 16px;
}
```

### **Container Secundário (Mesmo Plano)**
```css
.container-secondary {
  background: transparent;        /* Sem preenchimento */
  border: 1.5px solid var(--blue-dark); /* Linha simples azul escuro */
  border-radius: 8px;            /* Quinas arredondadas */
  padding: 16px;
  margin: 8px;
}
```
## 🌙 **TEMA ESCURO (NOTURNO) - IMPLEMENTADO E FUNCIONANDO**

### **🎨 ESQUEMA COMPLETO DE CORES DO TEMA ESCURO**

#### **Cores Principais do Tema Escuro**
```css
/* FUNDO PRINCIPAL */
--cor-fundo-escuro: #272A30;           /* Cinza escuro - Fundo da aplicação */

/* CONTAINERS E CARDS */
--cor-container-escuro: #323a42;       /* rgb(50, 58, 66) - Cinza médio */
--cor-card-escuro: #323a42;            /* rgb(50, 58, 66) - Cinza médio */

/* HEADER ESPECIAL */
--cor-header-escuro: #006AB9;          /* Azul opaco - Header diferenciado */

/* TEXTOS NO TEMA ESCURO */
--texto-principal-escuro: #F3F7FC;     /* Branco suave - Textos principais */
--texto-secundario-escuro: #B0BEC5;    /* Cinza claro - Textos secundários */
--texto-destaque-escuro: #1694FF;      /* Azul claro - Textos de destaque */

/* BORDAS E DIVISÓRIAS */
--borda-escura: rgba(255, 255, 255, 0.1);  /* Branco 10% - Bordas sutis */
--divisoria-escura: rgba(255, 255, 255, 0.2); /* Branco 20% - Divisórias */

/* SOMBRAS NO TEMA ESCURO */
--sombra-escura: rgba(0, 0, 0, 0.3);   /* Preto 30% - Sombras mais pronunciadas */
--sombra-header-escura: rgba(0, 102, 171, 0.3); /* Azul 30% - Sombra do header */
```

#### **🎯 HIERARQUIA DE CORES NO TEMA ESCURO**

##### **1. Fundos e Containers**
```css
/* Tema Claro → Tema Escuro */
--cor-fundo: #f0f4f8 → #272A30;           /* Fundo principal */
--cor-container: #f2f6fa → #323a42;       /* Containers e cards */
--cor-card: #f2f6fa → #323a42;            /* Cards individuais */
```

##### **2. Textos e Tipografia**
```css
/* Títulos principais */
.dark h1, .dark h2, .dark h3 {
    color: var(--texto-principal-escuro);  /* #F3F7FC - Branco suave */
}

/* Textos do corpo */
.dark p, .dark span, .dark div {
    color: var(--texto-secundario-escuro); /* #B0BEC5 - Cinza claro */
}

/* Textos de destaque */
.dark .highlight, .dark .accent {
    color: var(--texto-destaque-escuro);   /* #1694FF - Azul claro */
}
```

##### **3. Elementos Interativos**
```css
/* Botões no tema escuro */
.dark .velohub-btn {
    background: var(--blue-medium);        /* #1634FF - Azul médio */
    color: var(--texto-principal-escuro);  /* #F3F7FC - Branco suave */
    border: 1px solid var(--borda-escura); /* rgba(255,255,255,0.1) */
}

.dark .velohub-btn:hover {
    background: var(--blue-light);         /* #1694FF - Azul claro */
    box-shadow: 0 4px 12px var(--sombra-escura);
}

/* Inputs no tema escuro */
.dark .velohub-input {
    background: var(--cor-container-escuro); /* #323a42 - Cinza médio */
    color: var(--texto-principal-escuro);    /* #F3F7FC - Branco suave */
    border: 1px solid var(--borda-escura);   /* rgba(255,255,255,0.1) */
}

.dark .velohub-input:focus {
    border-color: var(--blue-light);         /* #1694FF - Azul claro */
    box-shadow: 0 0 0 3px rgba(22, 52, 255, 0.2);
}
```

##### **4. Cards e Containers Especiais**
```css
/* Cards de cursos no tema escuro */
.dark .course-card {
    background: var(--cor-card-escuro);      /* #323a42 - Cinza médio */
    border: 1px solid var(--borda-escura);   /* rgba(255,255,255,0.1) */
    box-shadow: 0 8px 32px var(--sombra-escura); /* rgba(0,0,0,0.3) */
}

.dark .course-card:hover {
    border-color: var(--blue-light);         /* #1694FF - Azul claro */
    box-shadow: 0 20px 40px var(--sombra-escura);
}

/* Header no tema escuro */
.dark .velohub-header {
    background: var(--cor-header-escuro);    /* #006AB9 - Azul opaco */
    border-bottom: 1px solid var(--divisoria-escura);
    box-shadow: 0 4px 20px var(--sombra-header-escura);
}
```

### **🎯 IMPLEMENTAÇÃO DO SISTEMA DE TEMA ESCURO**

#### **1. Variáveis CSS no :root**
```css
:root {
  /* CORES PRINCIPAIS */
  --white: #F3F7FC;        /* Tom de branco */
  --gray: #272A30;         /* Cinza */
  
  /* CORES DE FUNDO E CONTAINERS */
  --cor-fundo: #f0f4f8;        /* Fundo principal da aplicação */
  --cor-container: #f2f6fa;     /* Container principal - Cinza 2% mais claro que o fundo */
  --cor-card: #f2f6fa;         /* Fundo dos cards - Cinza 2% mais claro que o fundo */
}
```

#### **2. Classes CSS para Containers**
```css
/* Container principal */
.velohub-container {
  background-color: var(--cor-container);
}

/* Card padrão */
.velohub-card {
  background-color: var(--cor-card);
}

/* Modal e popups */
.velohub-modal {
  background-color: var(--white);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}
```

#### **3. Regras para Tema Escuro**
```css
/* Tema escuro - APLICADO AUTOMATICAMENTE */
.dark .velohub-container {
  background-color: #323a42;  /* rgb(50, 58, 66) */
}

.dark .velohub-card {
  background-color: #323a42;  /* rgb(50, 58, 66) */
}

.dark .velohub-modal {
  background-color: #323a42;  /* rgb(50, 58, 66) */
}
```

#### **4. Sistema de Toggle de Tema (JavaScript)**
```javascript
// Função para alternar tema
const toggleDarkMode = () => {
  const isDark = !isDarkMode;
  setIsDarkMode(isDark);
  
  if (isDark) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('velohub-theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('velohub-theme', 'light');
  }
};

// Aplicar tema salvo ao carregar
useEffect(() => {
  const savedTheme = localStorage.getItem('velohub-theme') || 'light';
  const isDark = savedTheme === 'dark';
  
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}, []);
```

#### **5. Layout do Header - Especificações Especiais**
```css
/* Header - Tema Claro */
.velohub-header {
  background-color: var(--cor-container);  /* #f2f6fa - Cinza claro */
  border-bottom: 1px solid var(--cor-borda);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Header - Tema Escuro */
[data-theme="dark"] .velohub-header {
  background-color: var(--blue-opaque);    /* #006AB9 - Azul opaco específico */
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 20px rgba(0, 102, 171, 0.3);
}

/* Container das Abas de Navegação */
.nav-menu {
  background-color: var(--cor-container);  /* Usa cor padrão dos containers */
  border-radius: 8px;
  padding: 8px 16px;
}

/* IMPORTANTE: Header mantém azul opaco no tema escuro */
/* Containers das abas usam cinza escuro (#323a42) */
/* Esta diferenciação cria hierarquia visual */
```

### **📋 GUIA COMPLETO PARA IMPLEMENTAR EM OUTROS PROJETOS CURSOR**

#### **🚀 PASSO 1: Configuração Inicial do Projeto**

##### **1.1 Estrutura de Arquivos Recomendada**
```
seu-projeto/
├── css/
│   ├── styles.css          # Estilos principais
│   ├── theme-dark.css      # Específico do tema escuro
│   └── components.css      # Componentes reutilizáveis
├── js/
│   ├── theme-toggle.js     # Sistema de alternância
│   └── main.js            # JavaScript principal
└── index.html             # Página principal
```

##### **1.2 Importar Fontes (Google Fonts)**
```html
<!-- Adicionar no <head> do HTML -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Anton&display=swap" rel="stylesheet">
```

#### **🎨 PASSO 2: Implementar Paleta de Cores Completa**

##### **2.1 Variáveis CSS Principais (styles.css)**
```css
:root {
  /* === PALETA OFICIAL VELOHUB === */
  --white: #F3F7FC;           /* Tom de branco */
  --gray: #272A30;            /* Cinza */
  --blue-dark: #000058;       /* Azul Escuro */
  --blue-medium: #1634FF;     /* Azul Médio */
  --blue-light: #1694FF;      /* Azul Claro */
  --blue-opaque: #006AB9;     /* Azul Opaco */
  --yellow: #FCC200;          /* Amarelo */
  --green: #15A237;           /* Verde */

  /* === CORES DE FUNDO E CONTAINERS === */
  --cor-fundo: #f0f4f8;       /* Fundo principal da aplicação */
  --cor-container: #f2f6fa;   /* Container principal */
  --cor-card: #f2f6fa;        /* Fundo dos cards */
  
  /* === CORES DO TEMA ESCURO === */
  --cor-fundo-escuro: #272A30;
  --cor-container-escuro: #323a42;
  --cor-card-escuro: #323a42;
  --cor-header-escuro: #006AB9;
  
  /* === TEXTOS NO TEMA ESCURO === */
  --texto-principal-escuro: #F3F7FC;
  --texto-secundario-escuro: #B0BEC5;
  --texto-destaque-escuro: #1694FF;
  
  /* === BORDAS E SOMBRAS === */
  --borda-escura: rgba(255, 255, 255, 0.1);
  --divisoria-escura: rgba(255, 255, 255, 0.2);
  --sombra-escura: rgba(0, 0, 0, 0.3);
  --sombra-header-escura: rgba(0, 102, 171, 0.3);
}
```

##### **2.2 Configuração Base do Body**
```css
body {
  font-family: 'Poppins', sans-serif;
  background-color: var(--cor-fundo);
  color: var(--gray);
  margin: 0;
  padding: 0;
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* Aplicar tema escuro no body */
.dark body {
  background-color: var(--cor-fundo-escuro);
  color: var(--texto-principal-escuro);
}
```

#### **🔧 PASSO 3: Criar Classes de Componentes**

##### **3.1 Containers e Cards (components.css)**
```css
/* === CONTAINERS PRINCIPAIS === */
.velohub-container {
  background-color: var(--cor-container);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 24px;
  margin: 16px;
  transition: all 0.3s ease;
}

.velohub-card {
  background-color: var(--cor-card);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin: 16px 0;
  border: 1px solid rgba(22, 52, 255, 0.1);
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

/* === HEADER === */
.velohub-header {
  background-color: var(--cor-container);
  border-bottom: 1px solid var(--borda-escura);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 16px 24px;
  transition: all 0.3s ease;
}

/* === BOTÕES === */
.velohub-btn {
  background: var(--blue-medium);
  color: var(--white);
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.velohub-btn:hover {
  background: var(--blue-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(22, 52, 255, 0.3);
}

/* === INPUTS === */
.velohub-input {
  background: var(--white);
  border: 1.5px solid var(--blue-dark);
  border-radius: 8px;
  padding: 12px 16px;
  font-family: 'Poppins', sans-serif;
  color: var(--gray);
  transition: all 0.3s ease;
}

.velohub-input:focus {
  outline: none;
  border-color: var(--blue-medium);
  box-shadow: 0 0 0 3px rgba(22, 52, 255, 0.1);
}
```

##### **3.2 Efeitos de Hover nos Cards**
```css
/* === ANIMAÇÃO DE HOVER === */
.velohub-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--blue-medium), var(--blue-light), var(--blue-medium));
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.velohub-card:hover::before {
  transform: scaleX(1);
}

.velohub-card:hover {
  transform: translateY(-12px) scale(1.02);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  border-color: var(--blue-light);
}
```

#### **🌙 PASSO 4: Implementar Tema Escuro (theme-dark.css)**

##### **4.1 Regras para Tema Escuro**
```css
/* === CONTAINERS NO TEMA ESCURO === */
.dark .velohub-container {
  background-color: var(--cor-container-escuro);
  box-shadow: 0 4px 20px var(--sombra-escura);
}

.dark .velohub-card {
  background-color: var(--cor-card-escuro);
  border: 1px solid var(--borda-escura);
  box-shadow: 0 8px 32px var(--sombra-escura);
}

.dark .velohub-card:hover {
  border-color: var(--blue-light);
  box-shadow: 0 20px 40px var(--sombra-escura);
}

/* === HEADER NO TEMA ESCURO === */
.dark .velohub-header {
  background-color: var(--cor-header-escuro);
  border-bottom: 1px solid var(--divisoria-escura);
  box-shadow: 0 4px 20px var(--sombra-header-escura);
}

/* === TEXTOS NO TEMA ESCURO === */
.dark h1, .dark h2, .dark h3, .dark h4, .dark h5, .dark h6 {
  color: var(--texto-principal-escuro);
}

.dark p, .dark span, .dark div, .dark li {
  color: var(--texto-secundario-escuro);
}

.dark .highlight, .dark .accent {
  color: var(--texto-destaque-escuro);
}

/* === BOTÕES NO TEMA ESCURO === */
.dark .velohub-btn {
  background: var(--blue-medium);
  color: var(--texto-principal-escuro);
  border: 1px solid var(--borda-escura);
}

.dark .velohub-btn:hover {
  background: var(--blue-light);
  box-shadow: 0 4px 12px var(--sombra-escura);
}

/* === INPUTS NO TEMA ESCURO === */
.dark .velohub-input {
  background: var(--cor-container-escuro);
  color: var(--texto-principal-escuro);
  border: 1px solid var(--borda-escura);
}

.dark .velohub-input:focus {
  border-color: var(--blue-light);
  box-shadow: 0 0 0 3px rgba(22, 52, 255, 0.2);
}
```

#### **⚡ PASSO 5: Sistema de Toggle (theme-toggle.js)**

##### **5.1 JavaScript para Alternância de Tema**
```javascript
// === SISTEMA DE TEMA ESCURO ===
class ThemeToggle {
  constructor() {
    this.isDarkMode = false;
    this.init();
  }

  init() {
    // Carregar tema salvo
    this.loadSavedTheme();
    
    // Criar botão de toggle
    this.createToggleButton();
    
    // Aplicar tema inicial
    this.applyTheme();
  }

  loadSavedTheme() {
    const savedTheme = localStorage.getItem('velohub-theme') || 'light';
    this.isDarkMode = savedTheme === 'dark';
  }

  createToggleButton() {
    const toggleBtn = document.createElement('button');
    toggleBtn.innerHTML = this.isDarkMode ? '☀️' : '🌙';
    toggleBtn.className = 'theme-toggle-btn';
    toggleBtn.onclick = () => this.toggleTheme();
    
    // Adicionar ao header ou onde preferir
    const header = document.querySelector('.velohub-header') || document.body;
    header.appendChild(toggleBtn);
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    this.applyTheme();
    this.saveTheme();
    this.updateToggleButton();
  }

  applyTheme() {
    const root = document.documentElement;
    
    if (this.isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  saveTheme() {
    const theme = this.isDarkMode ? 'dark' : 'light';
    localStorage.setItem('velohub-theme', theme);
  }

  updateToggleButton() {
    const btn = document.querySelector('.theme-toggle-btn');
    if (btn) {
      btn.innerHTML = this.isDarkMode ? '☀️' : '🌙';
    }
  }
}

// === INICIALIZAR QUANDO O DOM ESTIVER PRONTO ===
document.addEventListener('DOMContentLoaded', () => {
  new ThemeToggle();
});
```

##### **5.2 Estilos do Botão de Toggle**
```css
.theme-toggle-btn {
  background: var(--blue-medium);
  color: var(--white);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.theme-toggle-btn:hover {
  background: var(--blue-light);
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.dark .theme-toggle-btn {
  background: var(--blue-light);
  box-shadow: 0 4px 12px var(--sombra-escura);
}

.dark .theme-toggle-btn:hover {
  background: var(--blue-medium);
}
```

#### **📱 PASSO 6: Responsividade**

##### **6.1 Breakpoints e Grid**
```css
/* === RESPONSIVIDADE === */
@media (max-width: 768px) {
  .velohub-container {
    margin: 8px;
    padding: 16px;
  }
  
  .velohub-card {
    margin: 8px 0;
    padding: 16px;
  }
  
  .theme-toggle-btn {
    width: 35px;
    height: 35px;
    font-size: 16px;
    top: 15px;
    right: 15px;
  }
}

@media (max-width: 480px) {
  .velohub-container {
    margin: 4px;
    padding: 12px;
  }
  
  .velohub-card {
    padding: 12px;
  }
}
```

#### **🎯 PASSO 7: Aplicação nos Elementos HTML**

##### **7.1 Estrutura HTML Recomendada**
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seu Projeto - VeloHub Style</title>
  
  <!-- Fontes -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Anton&display=swap" rel="stylesheet">
  
  <!-- Estilos -->
  <link rel="stylesheet" href="css/styles.css">
  <link rel="stylesheet" href="css/components.css">
  <link rel="stylesheet" href="css/theme-dark.css">
</head>
<body>
  <!-- Header -->
  <header class="velohub-header">
    <h1>Meu Projeto</h1>
  </header>

  <!-- Container Principal -->
  <main class="velohub-container">
    <h2>Título Principal</h2>
    <p>Descrição do conteúdo...</p>
    
    <!-- Cards -->
    <div class="velohub-card">
      <h3>Card 1</h3>
      <p>Conteúdo do card...</p>
    </div>
    
    <div class="velohub-card">
      <h3>Card 2</h3>
      <p>Conteúdo do card...</p>
    </div>
    
    <!-- Botões -->
    <button class="velohub-btn">Botão Principal</button>
    
    <!-- Inputs -->
    <input type="text" class="velohub-input" placeholder="Digite algo...">
  </main>

  <!-- JavaScript -->
  <script src="js/theme-toggle.js"></script>
</body>
</html>
```

#### **✅ PASSO 8: Checklist de Implementação**

##### **8.1 Verificações Obrigatórias**
- [ ] **Fontes importadas** (Poppins + Anton)
- [ ] **Variáveis CSS definidas** (paleta completa)
- [ ] **Classes de componentes criadas** (.velohub-*)
- [ ] **Tema escuro implementado** (.dark)
- [ ] **JavaScript de toggle funcionando**
- [ ] **Responsividade testada**
- [ ] **Transições suaves aplicadas**
- [ ] **Contraste de cores validado**

##### **8.2 Testes Recomendados**
- [ ] **Alternar tema** (claro ↔ escuro)
- [ ] **Persistência** (recarregar página)
- [ ] **Hover nos cards** (animações)
- [ ] **Responsividade** (mobile/tablet/desktop)
- [ ] **Acessibilidade** (contraste WCAG)

#### **🚀 RESULTADO FINAL**

Após seguir todos os passos, você terá:

✅ **Sistema completo de temas** (claro/escuro)  
✅ **Paleta de cores oficial** VeloHub  
✅ **Componentes reutilizáveis** (.velohub-*)  
✅ **Animações suaves** e profissionais  
✅ **Responsividade** completa  
✅ **Toggle automático** com persistência  
✅ **Código limpo** e bem documentado  

**🎯 Pronto para usar em qualquer projeto Cursor!**

---

## 🎯 **EXEMPLOS PRÁTICOS PARA PROJETOS CURSOR**

### **📝 Exemplo 1: Página de Dashboard Simples**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - VeloHub Style</title>
  
  <!-- Fontes -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- Estilos -->
  <link rel="stylesheet" href="css/styles.css">
  <link rel="stylesheet" href="css/components.css">
  <link rel="stylesheet" href="css/theme-dark.css">
</head>
<body>
  <!-- Header com Toggle -->
  <header class="velohub-header">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h1>Meu Dashboard</h1>
      <div>
        <span>Bem-vindo, Usuário!</span>
      </div>
    </div>
  </header>

  <!-- Container Principal -->
  <main class="velohub-container">
    <h2>Visão Geral</h2>
    <p>Este é um exemplo de dashboard usando o sistema VeloHub.</p>
    
    <!-- Grid de Cards -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">
      <div class="velohub-card">
        <h3>📊 Estatísticas</h3>
        <p>Visualize suas métricas principais aqui.</p>
        <button class="velohub-btn">Ver Detalhes</button>
      </div>
      
      <div class="velohub-card">
        <h3>📈 Gráficos</h3>
        <p>Análises e relatórios em tempo real.</p>
        <button class="velohub-btn">Abrir Gráfico</button>
      </div>
      
      <div class="velohub-card">
        <h3>⚙️ Configurações</h3>
        <p>Personalize sua experiência.</p>
        <button class="velohub-btn">Configurar</button>
      </div>
    </div>
    
    <!-- Formulário de Exemplo -->
    <div class="velohub-card" style="margin-top: 30px;">
      <h3>Adicionar Novo Item</h3>
      <form style="display: flex; flex-direction: column; gap: 15px;">
        <input type="text" class="velohub-input" placeholder="Nome do item">
        <input type="email" class="velohub-input" placeholder="Email">
        <textarea class="velohub-input" placeholder="Descrição" style="min-height: 100px; resize: vertical;"></textarea>
        <button type="submit" class="velohub-btn">Salvar</button>
      </form>
    </div>
  </main>

  <!-- JavaScript -->
  <script src="js/theme-toggle.js"></script>
</body>
</html>
```

### **💡 Dicas Específicas para Cursor**

#### **Integração com Tailwind CSS**
```css
/* Se você usa Tailwind, adicione as variáveis como classes customizadas */
@layer base {
  :root {
    --velohub-white: #F3F7FC;
    --velohub-gray: #272A30;
    --velohub-blue-dark: #000058;
  }
}

/* Use com @apply */
.velohub-card {
  @apply bg-[var(--velohub-white)] rounded-xl shadow-lg p-5 transition-all duration-300;
}
```

#### **Integração com React**
```jsx
// Hook personalizado para tema
export const useTheme = () => {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    
    if (newTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('velohub-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('velohub-theme', 'light');
    }
  };

  return { isDark, toggleTheme };
};
```

#### **Otimização de Performance**
```css
/* Use will-change para animações suaves */
.velohub-card {
  will-change: transform, box-shadow;
}

/* Prefira transform em vez de mudanças de layout */
.velohub-card:hover {
  transform: translateY(-12px) scale(1.02); /* ✅ Bom */
}
```

#### **Acessibilidade**
```css
/* Sempre inclua focus states */
.velohub-btn:focus {
  outline: 2px solid var(--blue-light);
  outline-offset: 2px;
}

/* Use prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .velohub-card {
    transition: none;
  }
}
```

### **🎨 RESULTADO FINAL**
- **Modo Claro:** Containers usam `#f2f6fa` (cinza claro)
- **Modo Escuro:** Containers automaticamente mudam para `#323a42` (rgb(50, 58, 66))
- **Transição:** Automática e suave via CSS
- **Persistência:** Salva preferência no localStorage
- **Compatibilidade:** Funciona com Tailwind CSS e CSS puro

### **Textos**
```css
--text-primary: var(--gray);     /* Texto principal */
--text-secondary: var(--blue-dark); /* Texto secundário */
--text-accent: var(--blue-medium);  /* Texto de destaque */
--text-light: var(--white);      /* Texto claro */
```

### **Botões e Ações**
```css
--btn-primary: var(--blue-medium);   /* Botão principal */
--btn-secondary: var(--blue-dark);   /* Botão secundário */
--btn-success: var(--green);         /* Botão de sucesso */
--btn-warning: var(--yellow);        /* Botão de aviso */
```

---

## 📱 **Responsividade**

### **Breakpoints**
```css
/* Mobile First */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
```

### **Grid System**
```css
.grid-container {
  display: grid;
  grid-template-columns: 1fr;           /* Mobile: 1 coluna */
  gap: 16px;
}

@media (min-width: 1024px) {
  .grid-container {
    grid-template-columns: 1fr 2fr 1fr; /* Desktop: 3 colunas */
    gap: 24px;
  }
}
```

---

## 🔧 **Componentes Reutilizáveis**

### **Card Padrão (VeloHub)**
```css
.velohub-card {
  background: var(--white);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin: 16px 0;
  border: 1px solid rgba(22, 52, 255, 0.1);
}
```

### **Card Avançado com Gradiente (VeloAcademy)**
```css
.course-card {
  background: linear-gradient(135deg, var(--cor-card) 0%, rgba(255, 255, 255, 0.05) 100%);
  border: 1px solid var(--cor-borda);
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 8px 32px var(--cor-sombra);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

/* Linha decorativa no topo */
.course-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--cor-accent), #4dabf7, var(--cor-accent));
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.course-card:hover::before {
  transform: scaleX(1);
}

.course-card:hover {
  transform: translateY(-12px) scale(1.02);
  box-shadow: 0 20px 40px var(--cor-sombra);
  border-color: var(--cor-accent);
}
```

### **Sistema de Accordion (VeloAcademy)**
```css
.module-subtitle {
  margin: 10px 0 0 0;
  font-size: 1.1rem;
  color: var(--cor-texto-principal);
  font-weight: 500;
  padding: 12px 15px;
  background: var(--cor-container);
  border: 1px solid var(--cor-borda);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s ease;
  user-select: none;
}

.module-subtitle:hover {
  background: var(--cor-fundo);
  border-color: var(--cor-accent);
}

.module-subtitle.active {
  background: var(--cor-accent);
  color: var(--cor-fundo);
  border-color: var(--cor-accent);
}

.accordion-icon {
  font-size: 0.9rem;
  transition: transform 0.3s ease;
}

.module-subtitle.active .accordion-icon {
  transform: rotate(180deg);
}

.accordion-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
  width: 100%;
}

.accordion-content.active {
  max-height: 2000px;
}
```

---

## 🎭 **Animações CSS (VeloAcademy)**

### **Animação de Slide Up**
```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Aplicação em cards */
.course-card {
  opacity: 0;
  animation: slideUp 0.6s ease-out forwards;
}
```

### **Transições e Efeitos Hover**
```css
/* Transição suave para todos os elementos */
* {
  transition: all 0.3s ease;
}

/* Efeito de elevação no hover */
.course-card:hover {
  transform: translateY(-12px) scale(1.02);
  box-shadow: 0 20px 40px var(--cor-sombra);
}

/* Rotação do ícone do accordion */
.accordion-icon {
  transition: transform 0.3s ease;
}

.module-subtitle.active .accordion-icon {
  transform: rotate(180deg);
}
```

### **Botão Padrão**
```css
.velohub-btn {
  background: var(--blue-medium);
  color: var(--white);
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.velohub-btn:hover {
  background: var(--blue-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(22, 52, 255, 0.3);
}
```

### **Input Padrão**
```css
.velohub-input {
  background: var(--white);
  border: 1.5px solid var(--blue-dark);
  border-radius: 8px;
  padding: 12px 16px;
  font-family: 'Poppins', sans-serif;
  color: var(--gray);
  transition: border-color 0.3s ease;
}

.velohub-input:focus {
  outline: none;
  border-color: var(--blue-medium);
  box-shadow: 0 0 0 3px rgba(22, 52, 255, 0.1);
}
```

---



---

## 📋 **Checklist de Implementação**

- [ ] Importar fontes Poppins e Anton
- [ ] Definir variáveis CSS com paleta oficial
- [ ] Aplicar containers com sombreado e bordas arredondadas
- [ ] Implementar sistema de cores por contexto
- [ ] Criar componentes reutilizáveis
- [ ] Testar responsividade
- [ ] Validar acessibilidade de cores

---

## 🚀 **Próximos Passos**

1. **Implementar sistema de cores** em todas as páginas
2. **Aplicar tipografia oficial** (Poppins + Anton)
3. **Padronizar containers** com sombreado e bordas arredondadas
4. **Criar biblioteca de componentes** reutilizáveis
5. **Testar responsividade** em diferentes dispositivos
6. **Validar acessibilidade** de cores e contrastes

---

## 🏷️ **SISTEMA DE ETIQUETAS DE CURSOS (IMPLEMENTADO)**

### **Estrutura das Etiquetas**
```css
.course-badge {
    background: linear-gradient(135deg, cor1 0%, cor1 60%, cor2 100%);
    color: white;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
```

### **Tipos de Etiquetas e Cores**

#### **ESSENCIAL** 
```css
.course-card[data-course="onboarding"] .course-badge {
    background: linear-gradient(135deg, var(--blue-medium) 0%, var(--blue-medium) 60%, var(--blue-light) 100%);
}
```
- **Gradiente:** Azul Médio (`#1634FF`) → Azul Claro (`#1694FF`)
- **Uso:** Cursos fundamentais obrigatórios

#### **RECICLAGEM** 
```css
.course-card[data-course="cs004"] .course-badge {
    background: linear-gradient(135deg, var(--yellow) 0%, var(--yellow) 60%, var(--blue-medium) 100%);
}
```
- **Gradiente:** Amarelo (`#FCC200`) → Azul Médio (`#1634FF`)
- **Uso:** Cursos de atualização de conhecimentos

#### **OPCIONAL** 
```css
.course-card[data-course="cs003"] .course-badge {
    background: linear-gradient(135deg, var(--blue-dark) 0%, var(--blue-dark) 60%, var(--blue-opaque) 100%);
}
```
- **Gradiente:** Azul Escuro (`#000058`) → Azul Opaco (`#006AB9`)
- **Uso:** Cursos complementares não obrigatórios

#### **ATUALIZAÇÃO** 
```css
.course-card[data-course="operacoes"] .course-badge {
    background: linear-gradient(135deg, var(--blue-dark) 0%, var(--blue-dark) 60%, var(--yellow) 100%);
}
```
- **Gradiente:** Azul Escuro (`#000058`) → Amarelo (`#FCC200`)
- **Uso:** Cursos de novas tecnologias/métodos

---

## 🎨 **ESQUEMA DE CORES PARA CARDS DE CURSOS (IMPLEMENTADO)**

### **Hierarquia de Cores nos Cards**
```css
/* Títulos dos Cursos */
.course-card h3 {
    color: var(--blue-dark);        /* #000058 - Azul Escuro */
    font-family: 'Poppins', sans-serif;
    font-weight: 600;
}

/* Descrições dos Cursos */
.course-card p {
    color: var(--gray);              /* #272A30 - Cinza */
    font-family: 'Poppins', sans-serif;
    line-height: 1.6;
}

/* Linha Divisória */
.course-meta {
    border-top: 1px solid var(--blue-opaque); /* #006AB9 - Azul Opaco */
}
```

---

## 📚 **ESQUEMA DE CORES DENTRO DOS CURSOS (IMPLEMENTADO)**

### **Hierarquia de Cores na Visualização Interna**
```css
/* Títulos DENTRO dos Cursos */
#course-view .course-title-section h1 {
    color: var(--blue-dark);        /* #000058 - Azul Escuro */
}

.module-card h3 {
    color: var(--blue-dark);        /* #000058 - Azul Escuro */
}

.module-subtitle {
    color: var(--blue-dark);        /* #000058 - Azul Escuro */
}

.quiz-header h2 {
    color: var(--blue-dark);        /* #000058 - Azul Escuro */
}

.quiz-question h3 {
    color: var(--blue-dark);        /* #000058 - Azul Escuro */
}

.result-header h2 {
    color: var(--blue-dark);        /* #000058 - Azul Escuro */
}

/* Descrições DENTRO dos Cursos */
#course-view .course-title-section p {
    color: var(--gray);              /* #272A30 - Cinza */
}

.quiz-info {
    color: var(--gray);              /* #272A30 - Cinza */
}

.option-text {
    color: var(--blue-dark);        /* #000058 - Azul Escuro */
}
```

### **Regra de Aplicação**
- **TÍTULOS:** Sempre `var(--blue-dark)` (#000058) - Azul Escuro
- **DESCRIÇÕES:** Sempre `var(--gray)` (#272A30) - Cinza
- **APLICAR EM:** Cards, visualização interna, módulos, quiz, resultados

### **Layout de Grid para Cursos**
```css
#courses-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);  /* 3 colunas por fileira */
    gap: 30px;
    margin-top: 30px;
    width: 100%;
}

/* Responsividade */
@media (max-width: 768px) {
    #courses-grid {
        grid-template-columns: 1fr;         /* 1 coluna no mobile */
        gap: 20px;
    }
}
```

---

## ✨ **SISTEMA DE ANIMAÇÕES DOS CARDS (IMPLEMENTADO)**

### **Animação de Hover nos Cards de Cursos**
```css
/* Configuração Base do Card */
.course-card {
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    position: relative;
    overflow: hidden;
}

/* Barra Superior Animada */
.course-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--blue-medium), var(--blue-light), var(--blue-medium));
    transform: scaleX(0);
    transition: transform 0.3s ease;
}

/* Efeito de Hover */
.course-card:hover::before {
    transform: scaleX(1);  /* Barra superior aparece */
}

.course-card:hover {
    transform: translateY(-12px) scale(1.02);  /* Eleva e aumenta ligeiramente */
    box-shadow: 0 20px 40px var(--cor-sombra);  /* Sombra mais pronunciada */
    border-color: var(--cor-accent);  /* Borda colorida */
}
```

### **Características da Animação**
- **Transição Suave:** `cubic-bezier(0.4, 0, 0.2, 1)` para movimento natural
- **Barra Superior:** Aparece com gradiente azul no hover
- **Elevação:** Card sobe 12px e aumenta 2% de tamanho
- **Sombra:** Aumenta significativamente para efeito de profundidade
- **Borda:** Muda para cor de destaque

### **Variações de Animação**
```css
/* Versão Mais Sutil (Alternativa) */
.course-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px var(--cor-sombra);
}

/* Versão com Rotação (Alternativa) */
.course-card:hover {
    transform: translateY(-8px) rotate(1deg);
    box-shadow: 0 8px 30px var(--cor-sombra);
}
```

---

## 📋 **CHECKLIST DE IMPLEMENTAÇÃO ATUALIZADO**

- [x] **Importar fontes Poppins e Anton**
- [x] **Definir variáveis CSS com paleta oficial**
- [x] **Aplicar containers com sombreado e bordas arredondadas**
- [x] **Implementar sistema de cores por contexto**
- [x] **Criar sistema de etiquetas de cursos**
- [x] **Aplicar tipografia oficial**
- [x] **Padronizar cores de textos e divisórias**
- [x] **Implementar grid responsivo para cursos**
- [x] **Padronizar cores internas dos cursos**
- [x] **Implementar sistema de animações nos cards**
- [ ] **Criar componentes reutilizáveis**
- [ ] **Testar responsividade**
- [ ] **Validar acessibilidade de cores**

---

## 🔧 **IMPLEMENTAÇÃO EM OUTROS PROJETOS**

### **1. Importar Paleta de Cores**
```css
:root {
    /* PALETA OFICIAL VELOHUB */
    --white: #F3F7FC;
    --gray: #272A30;
    --blue-dark: #000058;
    --blue-medium: #1634FF;
    --blue-light: #1694FF;
    --blue-opaque: #006AB9;
    --yellow: #FCC200;
    --green: #15A237;
}
```

### **2. Aplicar Sistema de Etiquetas**
```css
/* Copiar estrutura de .course-badge e variações */
/* Adaptar cores conforme necessidade do projeto */
```

### **3. Implementar Esquema de Cores**
```css
/* Títulos: var(--blue-dark) */
/* Textos: var(--gray) */
/* Divisórias: var(--blue-opaque) */

/* IMPORTANTE: Aplicar tanto nos cards quanto DENTRO dos cursos */
/* Títulos internos: var(--blue-dark) */
/* Descrições internas: var(--gray) */
```

### **4. Implementar Sistema de Animações**
```css
/* Copiar estrutura de .course-card com transições */
/* Aplicar efeitos de hover: elevação, sombra, barra superior */
/* Usar cubic-bezier para transições suaves */
```

---

## 👤 **SISTEMA DE USUÁRIO LOGADO - ESPECIFICAÇÕES**

### **🎯 Botão de Usuário Logado**

#### **📋 Estrutura HTML Obrigatória**
```html
<div class="user-info" id="user-info">
    <img id="user-avatar" class="user-avatar" src="" alt="Avatar" style="display: none;">
    <span id="user-name" class="user-name"></span>
    <button id="logout-btn" class="logout-btn" title="Logout">
        <i class="fas fa-sign-out-alt"></i>
    </button>
</div>
```

#### **🎨 Especificações Visuais**

##### **Container Principal (.user-info)**
```css
.user-info {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background-color: var(--cor-container);
    border-radius: 8px;
    border: 1px solid var(--cor-borda);
    position: relative;
    z-index: 10;
    transition: all 0.3s ease;
}

.user-info:hover {
    background-color: var(--cor-borda);
}
```

##### **Avatar do Usuário (.user-avatar)**
```css
.user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--cor-accent);
}
```

##### **Nome do Usuário (.user-name)**
```css
.user-name {
    color: var(--cor-texto);
    font-weight: 500;
    font-size: 0.9rem;
    font-family: 'Poppins', sans-serif;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
```

##### **Botão de Logout (.logout-btn)**
```css
.logout-btn {
    background: none;
    border: none;
    color: var(--cor-texto-secundario);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: color 0.3s ease;
}

.logout-btn:hover {
    color: var(--cor-accent);
    background-color: rgba(22, 52, 255, 0.1);
}
```

#### **🌙 Tema Escuro**

##### **Container no Tema Escuro**
```css
.dark .user-info {
    background-color: var(--blue-opaque);
    border: 1px solid var(--gray);
}

.dark .user-info:hover {
    background-color: var(--blue-medium);
}
```

##### **Texto no Tema Escuro**
```css
.dark .user-name {
    color: var(--texto-principal-escuro);
}

.dark .logout-btn {
    color: var(--texto-secundario-escuro);
}

.dark .logout-btn:hover {
    color: var(--texto-destaque-escuro);
    background-color: rgba(22, 100, 255, 0.2);
}
```

#### **📱 Responsividade**

##### **Tablet (768px)**
```css
@media (max-width: 768px) {
    .user-info {
        right: 50px;
        padding: 6px 10px;
        gap: 8px;
    }
    
    .user-name {
        font-size: 0.8rem;
    }
    
    .user-avatar {
        width: 28px;
        height: 28px;
    }
}
```

##### **Mobile (480px)**
```css
@media (max-width: 480px) {
    .user-info {
        position: relative;
        right: auto;
        top: auto;
        margin: 10px 0;
    }
    
    .user-name {
        display: none;
    }
    
    .user-avatar {
        width: 24px;
        height: 24px;
    }
}
```

#### **🔧 Estados e Comportamentos**

##### **Estado Inicial (Não Logado)**
- **Visibilidade:** `display: none` ou `visibility: hidden`
- **Aplicar via JavaScript:** `document.getElementById('user-info').style.display = 'none'`

##### **Estado Logado**
- **Visibilidade:** `display: flex`
- **Avatar:** Carregar imagem do Google (se disponível)
- **Nome:** Exibir nome completo do usuário
- **Logout:** Funcional com confirmação

##### **Estado Sem Avatar**
```css
.user-info.no-avatar .user-name {
    margin-left: 0;
}
```

#### **⚡ Funcionalidades JavaScript**

##### **Inicialização**
```javascript
// Carregar dados do usuário
function loadUserInfo() {
    const sessionData = localStorage.getItem('veloacademy_user_session');
    if (sessionData) {
        const session = JSON.parse(sessionData);
        const userInfo = document.getElementById('user-info');
        const userName = document.getElementById('user-name');
        const userAvatar = document.getElementById('user-avatar');
        
        // Mostrar container
        userInfo.style.display = 'flex';
        
        // Definir nome
        userName.textContent = session.user.name;
        
        // Definir avatar (se disponível)
        if (session.user.picture) {
            userAvatar.src = session.user.picture;
            userAvatar.style.display = 'block';
        }
    }
}
```

##### **Logout**
```javascript
// Função de logout
function handleLogout() {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.removeItem('veloacademy_user_session');
        location.reload();
    }
}

// Event listener
document.getElementById('logout-btn').addEventListener('click', handleLogout);
```

#### **🎯 Integração com Header**

##### **Posicionamento no Header**
```css
.header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
}

.user-info {
    position: absolute;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
}
```

##### **Z-index e Overlay**
```css
.user-info {
    z-index: 10;
    background-color: var(--cor-container);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
```

#### **✅ Checklist de Implementação**

- [ ] **Estrutura HTML** com IDs corretos
- [ ] **Estilos CSS** aplicados (.user-info, .user-avatar, .user-name, .logout-btn)
- [ ] **Tema escuro** implementado
- [ ] **Responsividade** para mobile/tablet
- [ ] **JavaScript** para carregar dados do usuário
- [ ] **Função de logout** funcional
- [ ] **Estados visuais** (logado/não logado)
- [ ] **Tratamento de avatar** (com/sem imagem)
- [ ] **Posicionamento** correto no header
- [ ] **Transições suaves** nos hovers

#### **🎨 Variações de Design**

##### **Versão Compacta (Mobile)**
- Apenas avatar e botão logout
- Nome oculto para economizar espaço

##### **Versão Completa (Desktop)**
- Avatar + Nome + Botão logout
- Hover com informações adicionais

##### **Versão Minimalista**
- Apenas nome e botão logout
- Sem avatar para design mais limpo

---

*Este documento foi atualizado com as implementações realizadas na página de cursos do VeloAcademy e especificações do sistema de usuário logado.*
