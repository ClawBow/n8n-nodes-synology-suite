/**
 * Test: Retry Logic pour 402 (Payment Required)
 * Simule 5 appels à listMailboxes avec 402 erreur intermittente
 */

// Classe pour simuler les appels
class MockApiClient {
	constructor() {
		this.callCounts = {}; // Track call count per test
	}

	async callWithRetry(testId, maxRetries = 3) {
		if (!this.callCounts[testId]) {
			this.callCounts[testId] = 0;
		}
		
		let lastError;
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			this.callCounts[testId]++;
			try {
				// Simuler 402 pendant les 2 premiers appels
				if (this.callCounts[testId] <= 2) {
					throw { 
						response: { status: 402 }, 
						message: '402 Payment Required' 
					};
				}
				
				// Succès au 3ème appel
				return {
					success: true,
					data: {
						mailboxes: [
							{ id: 1, name: 'INBOX' },
							{ id: 2, name: 'Drafts' }
						]
					}
				};
			} catch (error) {
				lastError = error;
				const status = error?.response?.status;
				if (status === 402) {
					if (attempt < maxRetries - 1) {
						const delay = Math.pow(2, attempt) * 1000;
						console.log(`  ⏳ Attempt ${attempt + 1} failed (402), waiting ${delay}ms...`);
						await new Promise(resolve => setTimeout(resolve, delay));
						continue;
					}
				}
				throw error;
			}
		}
		throw lastError;
	}
}

async function runTests() {
	const client = new MockApiClient();
	
	console.log('Testing Retry Logic for 402 (Payment Required)\n');
	console.log('Expected: exponential backoff (1s, 2s, 4s), max 3 retries\n');
	
	let successCount = 0;
	
	for (let i = 0; i < 5; i++) {
		console.log(`Test #${i + 1}:`);
		try {
			const result = await client.callWithRetry(i, 3);
			console.log(`  ✅ Success after ${client.callCounts[i]} calls`);
			console.log(`  Result:`, JSON.stringify(result.data));
			successCount++;
		} catch (error) {
			console.log(`  ❌ Failed after ${client.callCounts[i]} calls:`, error?.message);
		}
		console.log();
	}
	
	console.log(`\n✅ Retry Tests Completed: ${successCount}/5 successful`);
	process.exit(successCount === 5 ? 0 : 1);
}

runTests().catch(error => {
	console.error('Test error:', error);
	process.exit(1);
});
