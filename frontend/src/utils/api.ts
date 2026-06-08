/**
 * Self-healing resilient fetch wrapper.
 * Automatically retries failed API requests (like network failures or 500/502 errors)
 * using exponential backoff to allow the backend time to recover.
 */
export async function resilientFetch(url: string, options: RequestInit = {}, maxRetries = 5, initialBackoff = 1000): Promise<Response> {
  let attempt = 0;
  let backoff = initialBackoff;
  
  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, options);
      
      // If the backend returns a 5xx error (server crashing/restarting), throw to trigger retry
      if (!res.ok && res.status >= 500 && attempt < maxRetries) {
        throw new Error(`Server returned ${res.status}`);
      }
      
      // Return 200s and 400s (client/auth errors shouldn't be blindly retried)
      return res; 
    } catch (err) {
      if (attempt === maxRetries) {
        console.error(`[Self-Healing API] Final attempt failed for ${url}. Giving up.`);
        throw err;
      }
      
      console.warn(`[Self-Healing API] Request to ${url} failed. Backend may be offline. Retrying in ${Math.round(backoff)}ms... (Attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      
      // Exponential backoff
      backoff *= 1.5; 
      attempt++;
    }
  }
  
  throw new Error("API completely unreachable.");
}
