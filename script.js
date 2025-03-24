// Configuration (replace these with your values)
const HF_API_KEY = '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'; // Replace with your Hugging Face API key
const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'; // Embedding model
const GENERATIVE_MODEL = 'meta-llama/Llama-3.2-3B-Instruct'; // Generative model llama

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
        appendMessage('assistant', 'Error: Could not process your request. Please try again later.');
    }
}

// Fetch embedding from Hugging Face Inference API
async function getEmbedding(text) {
    const url = `https://api-inference.huggingface.co/models/${EMBEDDING_MODEL}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${HF_API_KEY}`
        },
        body: JSON.stringify({ inputs: text })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get embedding: ${errorText}`);
    }

    const result = await response.json();
    // Hugging Face embedding models return a list of embeddings; take the first
    if (Array.isArray(result) && result.length > 0) {
        return result[0];
    } else {
        throw new Error(`Unexpected embedding response: ${JSON.stringify(result)}`);
    }
}

// Fetch generated answer from Hugging Face Inference API
async function generateAnswer(prompt) {
    const url = `https://api-inference.huggingface.co/models/${GENERATIVE_MODEL}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${HF_API_KEY}`
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                max_new_tokens: 200, // Adjust based on desired output length
                return_full_text: false // Only return the generated text
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate answer: ${errorText}`);
    }

    const result = await response.json();
    // Handle different response formats from generative models
    if (Array.isArray(result) && result.length > 0 && result[0].generated_text) {
        return result[0].generated_text.trim();
    } else if (typeof result === 'string') {
        return result.trim();
    } else {
        throw new Error(`Unexpected generation response: ${JSON.stringify(result)}`);
    }
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
