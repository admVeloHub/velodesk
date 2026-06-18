const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

process.env.DISABLE_AUTO_UPDATE = 'true';

// Armazenar instância do cliente WhatsApp
let whatsappClient = null;
let qrCodeData = null;
let isConnected = false;
let conversationsCache = [];
let messagesCache = {};

// Inicializar cliente WhatsApp
function initializeWhatsApp() {
    console.log('Inicializando WhatsApp Web...');
    console.log('Aguarde, isso pode levar alguns segundos...');
    console.log('Abrindo navegador...');
    
    whatsappClient = new Client({
        authStrategy: new LocalAuth({
            dataPath: path.join(__dirname, '.wwebjs_auth')
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows'
            ],
            timeout: 120000, // 120 segundos de timeout
            protocolTimeout: 120000
        },
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2413.51-beta.html',
        }
    });

    // Event: QR Code gerado
    whatsappClient.on('qr', (qr) => {
        console.log('\n========================================');
        console.log('QR CODE GERADO!');
        console.log('========================================\n');
        qrCodeData = qr;
        qrcode.generate(qr, { small: true });
        console.log('\nEscaneie o QR Code acima com seu WhatsApp!\n');
        isConnected = false;
    });

    // Event: Cliente pronto
    whatsappClient.on('ready', async () => {
        console.log('\n========================================');
        console.log('WhatsApp Web conectado e pronto!');
        console.log('========================================\n');
        isConnected = true;
        qrCodeData = null;
        try {
            console.log('Carregando conversas iniciais...');
            await loadConversations();
            console.log('Conversas carregadas com sucesso!');
        } catch (error) {
            console.error('Erro ao carregar conversas iniciais:', error);
        }
    });

    // Event: Autenticação realizada
    whatsappClient.on('authenticated', () => {
        console.log('Autenticação realizada com sucesso!');
        console.log('Aguardando conexão completa...');
    });

    // Event: Falha na autenticação
    whatsappClient.on('auth_failure', (msg) => {
        console.error('\n========================================');
        console.error('FALHA NA AUTENTICAÇÃO:', msg);
        console.error('========================================\n');
        console.error('Tente limpar o cache e reconectar.');
        isConnected = false;
    });

    // Event: Desconectado
    whatsappClient.on('disconnected', (reason) => {
        console.log('\n========================================');
        console.log('WhatsApp DESCONECTADO:', reason);
        console.log('========================================\n');
        isConnected = false;
        conversationsCache = [];
        messagesCache = {};
    });
    
    // Event: Loading Screen
    whatsappClient.on('loading_screen', (percent, message) => {
        console.log(`Carregando: ${percent}% - ${message}`);
    });

    // Event: Nova mensagem recebida
    whatsappClient.on('message', async (message) => {
        try {
            console.log('Nova mensagem recebida:', message.from, message.body?.substring(0, 50) || '[sem texto]');
            
            // Atualizar cache de mensagens
            const chatId = message.from;
            if (!messagesCache[chatId]) {
                messagesCache[chatId] = [];
            }
            
            const messageData = {
                id: message.id.id,
                text: message.body || message.caption || '[Mensagem sem texto]',
                sender: message.fromMe ? 'me' : 'them',
                time: new Date(message.timestamp * 1000).toISOString(),
                from: message.from,
                fromMe: message.fromMe
            };
            
            messagesCache[chatId].push(messageData);
            
            // Manter apenas últimas 100 mensagens por conversa
            if (messagesCache[chatId].length > 100) {
                messagesCache[chatId] = messagesCache[chatId].slice(-100);
            }
            
            // Atualizar última mensagem na lista de conversas (com tratamento de erro)
            try {
                const conversationExists = conversationsCache.find(c => c.id === chatId);
                await updateConversationLastMessage(chatId, message.body || message.caption || '[Mensagem sem texto]', message.timestamp);
                
                // Se a conversa não existia no cache, recarregar todas as conversas para incluir a nova
                if (!conversationExists) {
                    console.log('Nova conversa detectada, recarregando lista de conversas...');
                    // Recarregar conversas em background (não bloquear)
                    loadConversations().catch(err => {
                        if (!err.message.includes('ContactMethods') && !err.message.includes('getIsMyContact')) {
                            console.error('Erro ao recarregar conversas após nova mensagem:', err);
                        }
                    });
                }
            } catch (updateError) {
                // Ignorar erros relacionados a ContactMethods (não críticos)
                if (!updateError.message.includes('ContactMethods') && !updateError.message.includes('getIsMyContact')) {
                    console.error('Erro ao atualizar última mensagem:', updateError.message);
                }
            }
        } catch (error) {
            // Tratamento geral de erros no evento de mensagem
            if (!error.message.includes('ContactMethods') && !error.message.includes('getIsMyContact')) {
                console.error('Erro ao processar nova mensagem:', error.message);
            }
        }
    });

    // Inicializar cliente
    console.log('Iniciando cliente WhatsApp...');
    console.log('Aguarde, o navegador está sendo aberto...');
    
    whatsappClient.initialize().catch(err => {
        console.error('\n========================================');
        console.error('ERRO AO INICIALIZAR WHATSAPP:', err.message);
        console.error('========================================\n');
        console.error('Detalhes:', err);
        console.error('\nTente:');
        console.error('1. Limpar o cache: limpar_cache.bat');
        console.error('2. Reinstalar dependências: npm install');
        console.error('3. Verificar se o Node.js está atualizado');
        console.error('4. Se persistir, tente executar com headless: false\n');
        
        // Tentar reinicializar após 5 segundos
        setTimeout(() => {
            console.log('Tentando reinicializar...');
            initializeWhatsApp();
        }, 5000);
    });
}

// Função para carregar conversas
async function loadConversations() {
    try {
        console.log('Carregando conversas...');
        const chats = await whatsappClient.getChats();
        
        conversationsCache = await Promise.all(chats.map(async (chat) => {
            try {
                let contact = null;
                let contactName = chat.name || 'Sem nome';
                let contactPhone = null;
                
                // Tentar obter informações do contato
                try {
                    contact = await chat.getContact();
                    if (contact) {
                        contactName = contact.pushname || contact.name || contactName;
                        contactPhone = contact.number || chat.id.user || null;
                    }
                } catch (contactError) {
                    // Ignorar erros relacionados a ContactMethods (não críticos)
                    if (!contactError.message.includes('ContactMethods') && !contactError.message.includes('getIsMyContact')) {
                        console.log('Erro ao obter contato, usando informações do chat:', contactError.message);
                    }
                    // Se falhar, usar informações básicas do chat
                    contactName = chat.name || chat.id.user || 'Sem nome';
                    contactPhone = chat.id.user || null;
                }
                
                // Tentar obter última mensagem
                let lastMessage = null;
                let lastMessageTime = new Date().toISOString();
                try {
                    const messages = await chat.fetchMessages({ limit: 1 });
                    if (messages.length > 0) {
                        lastMessage = messages[0];
                    }
                } catch (messageError) {
                    console.log('Erro ao obter última mensagem:', messageError.message);
                }
                
                return {
                    id: chat.id._serialized,
                    name: contactName,
                    phone: contactPhone,
                    lastMessage: lastMessage ? lastMessage.body : 'Sem mensagens',
                    lastMessageTime: lastMessage ? new Date(lastMessage.timestamp * 1000).toISOString() : lastMessageTime,
                    unread: chat.unreadCount || 0,
                    isGroup: chat.isGroup || false
                };
            } catch (error) {
                console.error('Erro ao processar chat:', error);
                // Retornar informações básicas mesmo com erro
                return {
                    id: chat.id._serialized,
                    name: chat.name || 'Sem nome',
                    phone: chat.id.user || null,
                    lastMessage: 'Sem mensagens',
                    lastMessageTime: new Date().toISOString(),
                    unread: 0,
                    isGroup: chat.isGroup || false
                };
            }
        }));
        
        // Ordenar por última mensagem (mais recente primeiro)
        conversationsCache.sort((a, b) => {
            return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
        });
        
        console.log(`${conversationsCache.length} conversas carregadas`);
    } catch (error) {
        console.error('Erro ao carregar conversas:', error);
        // Retornar array vazio em caso de erro
        conversationsCache = [];
    }
}

// Função para atualizar última mensagem de uma conversa
async function updateConversationLastMessage(chatId, messageText, timestamp) {
    try {
        const conversation = conversationsCache.find(c => c.id === chatId);
        if (conversation) {
            conversation.lastMessage = messageText;
            conversation.lastMessageTime = new Date(timestamp * 1000).toISOString();
        } else {
            // Se a conversa não existe no cache, buscar informações
            try {
                const chat = await whatsappClient.getChatById(chatId);
                let contactName = chat.name || 'Sem nome';
                let contactPhone = chat.id.user || null;
                
                // Tentar obter informações do contato com tratamento de erro
                try {
                    const contact = await chat.getContact();
                    if (contact) {
                        contactName = contact.pushname || contact.name || contactName;
                        contactPhone = contact.number || contactPhone;
                    }
                } catch (contactError) {
                    // Ignorar erros relacionados a ContactMethods
                    if (!contactError.message.includes('ContactMethods') && !contactError.message.includes('getIsMyContact')) {
                        console.log('Erro ao obter contato (não crítico):', contactError.message);
                    }
                    // Usar informações do chat como fallback
                }
                
                conversationsCache.push({
                    id: chat.id._serialized,
                    name: contactName,
                    phone: contactPhone,
                    lastMessage: messageText,
                    lastMessageTime: new Date(timestamp * 1000).toISOString(),
                    unread: chat.unreadCount || 0,
                    isGroup: chat.isGroup || false
                });
            } catch (error) {
                // Se falhar completamente, criar entrada básica
                if (!error.message.includes('ContactMethods') && !error.message.includes('getIsMyContact')) {
                    console.error('Erro ao atualizar conversa:', error);
                }
                
                // Adicionar entrada básica mesmo com erro
                conversationsCache.push({
                    id: chatId,
                    name: 'Sem nome',
                    phone: chatId.split('@')[0] || null,
                    lastMessage: messageText,
                    lastMessageTime: new Date(timestamp * 1000).toISOString(),
                    unread: 0,
                    isGroup: chatId.includes('@g.us')
                });
            }
        }
    } catch (error) {
        // Tratamento geral de erros
        if (!error.message.includes('ContactMethods') && !error.message.includes('getIsMyContact')) {
            console.error('Erro geral ao atualizar conversa:', error);
        }
    }
}

// Função para carregar mensagens de uma conversa
async function loadConversationMessages(chatId) {
    try {
        console.log('Buscando mensagens para chatId:', chatId);
        const chat = await whatsappClient.getChatById(chatId);
        console.log('Chat encontrado:', chat.id._serialized);
        
        const messages = await chat.fetchMessages({ limit: 50 });
        console.log(`Encontradas ${messages.length} mensagens para o chat ${chatId}`);
        
        if (messages.length === 0) {
            console.log('Nenhuma mensagem encontrada para este chat');
            return [];
        }
        
        const formattedMessages = messages.map(msg => {
            try {
                return {
                    id: msg.id.id,
                    text: msg.body || msg.caption || '[Mensagem sem texto]',
                    sender: msg.fromMe ? 'me' : 'them',
                    time: new Date(msg.timestamp * 1000).toISOString(),
                    from: msg.from,
                    fromMe: msg.fromMe
                };
            } catch (msgError) {
                console.error('Erro ao formatar mensagem:', msgError);
                return null;
            }
        }).filter(msg => msg !== null);
        
        // Ordenar por timestamp (mais antigas primeiro para exibição)
        formattedMessages.sort((a, b) => {
            return new Date(a.time) - new Date(b.time);
        });
        
        console.log(`Retornando ${formattedMessages.length} mensagens formatadas`);
        return formattedMessages;
    } catch (error) {
        console.error('Erro ao carregar mensagens:', error);
        console.error('Stack trace:', error.stack);
        return [];
    }
}

// ===== ENDPOINTS DA API =====

function mountWhatsAppRoutes(app) {
// GET /api/whatsapp/status - Status da conexão
app.get('/api/whatsapp/status', (req, res) => {
    res.json({
        connected: isConnected,
        hasQRCode: qrCodeData !== null,
        qrCode: qrCodeData
    });
});

// GET /api/whatsapp/qrcode - Obter QR Code
app.get('/api/whatsapp/qrcode', (req, res) => {
    if (qrCodeData) {
        res.json({
            qrCode: qrCodeData,
            connected: false
        });
    } else if (isConnected) {
        res.json({
            qrCode: null,
            connected: true,
            message: 'WhatsApp já está conectado'
        });
    } else {
        res.status(404).json({
            error: 'QR Code não disponível. Aguarde a geração.'
        });
    }
});

// GET /api/whatsapp/conversations - Lista de conversas
app.get('/api/whatsapp/conversations', async (req, res) => {
    if (!isConnected || !whatsappClient) {
        return res.status(503).json({
            error: 'WhatsApp não está conectado',
            connected: false
        });
    }

    try {
        // Recarregar conversas se necessário
        if (conversationsCache.length === 0) {
            await loadConversations();
        }
        
        res.json(conversationsCache);
    } catch (error) {
        console.error('Erro ao buscar conversas:', error);
        res.status(500).json({
            error: 'Erro ao buscar conversas',
            message: error.message
        });
    }
});

// GET /api/whatsapp/conversations/:id/messages - Mensagens de uma conversa
app.get('/api/whatsapp/conversations/:id/messages', async (req, res) => {
    if (!isConnected || !whatsappClient) {
        return res.status(503).json({
            error: 'WhatsApp não está conectado',
            connected: false
        });
    }

    try {
        const chatId = req.params.id;
        const messages = await loadConversationMessages(chatId);
        
        // Atualizar cache
        messagesCache[chatId] = messages;
        
        res.json(messages);
    } catch (error) {
        console.error('Erro ao buscar mensagens:', error);
        res.status(500).json({
            error: 'Erro ao buscar mensagens',
            message: error.message
        });
    }
});

// POST /api/whatsapp/send-message - Enviar mensagem
app.post('/api/whatsapp/send-message', async (req, res) => {
    if (!isConnected || !whatsappClient) {
        return res.status(503).json({
            error: 'WhatsApp não está conectado',
            connected: false
        });
    }

    try {
        const { conversationId, message } = req.body;

        if (!conversationId || !message) {
            return res.status(400).json({
                error: 'conversationId e message são obrigatórios'
            });
        }

        // Enviar mensagem
        const chatId = conversationId.includes('@') ? conversationId : `${conversationId}@c.us`;
        const sentMessage = await whatsappClient.sendMessage(chatId, message);

        // Atualizar cache de mensagens
        if (!messagesCache[chatId]) {
            messagesCache[chatId] = [];
        }

        const messageData = {
            id: sentMessage.id.id,
            text: message,
            sender: 'me',
            time: new Date().toISOString(),
            from: chatId,
            fromMe: true
        };

        messagesCache[chatId].push(messageData);

        // Atualizar última mensagem na lista de conversas
        await updateConversationLastMessage(chatId, message, Date.now() / 1000);

        res.json({
            success: true,
            messageId: sentMessage.id.id,
            message: 'Mensagem enviada com sucesso'
        });
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(500).json({
            error: 'Erro ao enviar mensagem',
            message: error.message
        });
    }
});

// POST /api/whatsapp/reload-conversations - Recarregar conversas
app.post('/api/whatsapp/reload-conversations', async (req, res) => {
    if (!isConnected || !whatsappClient) {
        return res.status(503).json({
            error: 'WhatsApp não está conectado',
            connected: false
        });
    }

    try {
        await loadConversations();
        res.json({
            success: true,
            count: conversationsCache.length,
            message: 'Conversas recarregadas com sucesso'
        });
    } catch (error) {
        console.error('Erro ao recarregar conversas:', error);
        res.status(500).json({
            error: 'Erro ao recarregar conversas',
            message: error.message
        });
    }
});

// GET /api/whatsapp/info - Informações do cliente
app.get('/api/whatsapp/info', async (req, res) => {
    if (!isConnected || !whatsappClient) {
        return res.status(503).json({
            error: 'WhatsApp não está conectado',
            connected: false
        });
    }

    try {
        const info = await whatsappClient.info;
        res.json({
            connected: true,
            info: {
                wid: info.wid,
                pushname: info.pushname,
                platform: info.platform
            }
        });
    } catch (error) {
        console.error('Erro ao buscar informações:', error);
        res.status(500).json({
            error: 'Erro ao buscar informações',
            message: error.message
        });
    }
});

}

function getWhatsAppHealth() {
    return {
        connected: isConnected,
        hasClient: whatsappClient !== null
    };
}

async function destroyWhatsApp() {
    if (whatsappClient) {
        await whatsappClient.destroy();
    }
}

module.exports = {
    mountWhatsAppRoutes,
    initializeWhatsApp,
    getWhatsAppHealth,
    destroyWhatsApp
};

