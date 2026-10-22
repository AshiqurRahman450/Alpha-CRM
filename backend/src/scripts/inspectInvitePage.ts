import axios from 'axios';

async function main() {
  const url = 'https://chat.whatsapp.com/IFEcdscoNQ89DNPY40YVhV';
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    console.log('HTML status:', res.status);
    const matches = res.data.match(/og:title" content="([^"]+)"/);
    console.log('Group Title:', matches ? matches[1] : 'not found');
    const descMatches = res.data.match(/og:description" content="([^"]+)"/);
    console.log('Group Desc:', descMatches ? descMatches[1] : 'not found');
    
    // Check for any group ID or JID in scripts
    const jidMatches = res.data.match(/\d+-\d+@g\.us|\d{10,25}@g\.us/g);
    console.log('JID matches:', jidMatches);
  } catch (err: any) {
    console.log('Failed to fetch group page:', err.message);
  }
}

main();
