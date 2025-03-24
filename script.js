// Load precomputed document chunks and embeddings
let data = [];
fetch('data.json')
    .then(response => response.json())
    .then(json => {
        data = json;
        data.forEach(item => {
            item.norm = Math.sqrt(item.embedding.reduce((sum, val) => sum + val * val, 0));
        });
    })
    .catch(error => console.error('Error loading data:', error));

// Event listeners
document.getElementById('sendButton').addEventListener('click', sendMessage);
document.getElementById('userInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
    const query = document.getElementById('userInput').value.trim();
    if (!query) return;

    appendMessage('user', query);
    document.getElementById('userInput').value = '';

    try {
        const queryEmbedding = await getEmbedding(query);
        const relevantChunks = getRelevantChunks(queryEmbedding, 3);
        const prompt = `Use the following documents to answer the question:\n${relevantChunks.join('\n')}\nQuestion: ${query}\nAnswer:`;
        const answer = await generateAnswer(prompt);
        appendMessage('assistant', answer);
    } catch (error) {
        console.error('Error:', error);
        appendMessage('assistant', 'Error: Could not connect to the server. Please try again later.');
    }
}

// Fetch embedding from external API
async function getEmbedding(text) {
    const response = await fetch('https://your-server.com/api/embeddings', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_API_KEY'
        },
        body: JSON.stringify({ prompt: text, model: 'your-embedding-model' })
    });
    if (!response.ok) throw new Error('Failed to get embedding');
    const result = await response.json();
    return result.data.embedding; // Example adjustment for response structure
}

// Fetch generated answer from external API
async function generateAnswer(prompt) {
    const response = await fetch('https://your-server.com/api/generate', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_API_KEY'
        },
        body: JSON.stringify({ prompt, model: 'your-generative-model' })
    });
    if (!response.ok) throw new Error('Failed to generate answer');
    const result = await response.json();
    return result.data.text; // Example adjustment for response structure
}

// Cosine similarity-based retrieval
function getRelevantChunks(queryEmbedding, k) {
    const queryNorm = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));
    const similarities = data.map(item => {
        const dotProduct = item.embedding.reduce((sum, val, i) => sum + val * queryEmbedding[i], 0);
        const similarity = dotProduct / (item.norm * queryNorm || 1);
        return { chunk: item.chunk, similarity };
    });
    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, k).map(item => item.chunk);
}

// Append message to chat
function appendMessage(sender, text) {
    const messageList = document.getElementById('messageList');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'assistant-message');
    messageDiv.textContent = text;
    messageList.appendChild(messageDiv);
    messageList.scrollTop = messageList.scrollHeight;
}
