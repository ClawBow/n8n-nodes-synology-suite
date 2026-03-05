/**
 * Test: Retry Logic pour 402 (Payment Required)
 * Simule 5 appels à listMailboxes avec 402 erreur intermittente
 */

const axios = require('axios');

// Mock server qui simule des erreurs 402
let requestCount = 0;
const mockServer = {
	handleRequest: () => {
		requestCount++;
		if (requestCount < 4) {
			// Retourner 402 pour les 3 premiers appels
			return {
				data: {
					success: false,
					error: { code: 402 }
				},
				status: 402
			};
		}
		// Succès au 4ème appel
		return {
			data: {
				success: true,
				data: {
					mailboxes: [
						{ id: 1, name: 'INBOX' },
						{ id: 2, name: 'Drafts' }
					]
				}
			},
			status: 200
		};
	}
};

// Simuler une fonction de requête avec retry logic
async function callWithRetry(maxRetries = 3) {
	let lastError;
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			const result = mockServer.handleRequest();
			if (result.status === 200) {
				console.log(`✅ Success at attempt ${attempt + 1}`);
				return result.data;
			}
			if (result.status === 402) {
				throw { response: result, message: '402 Payment Required' };
			}
		} catch (error) {
			lastError = error;
			const status = error?.response?.status;
			if (status === 402) {
				if (attempt < maxRetries - 1) {
					const delay = Math.pow(2, attempt) * 1000;
					console.log(`⏳ Attempt ${attempt + 1} failed with 402, retrying in ${delay}ms...`);
					await new Promise(resolve => setTimeout(resolve, delay));
					continue;
				}
			}
			throw error;
		}
	}
	throw lastError;
}

// Tester 5 appels avec le retry logic
async function runTests() {
	console.log('Testing Retry Logic for 402 (Payment Required)\n');
	
	for (let i = 0; i < 5; i++) {
		console.log(`\n--- Test #${i + 1} ---`);
		requestCount = 0;
		try {
			const result = await callWithRetry(3);
			console.log(`Result:`, JSON.stringify(result, null, 2));
		} catch (error) {
			console.error(`❌ Failed:`, error?.message || error);
		}
	}
	
	console.log('\n✅ All tests completed');
}

runTests().catch(console.error);
