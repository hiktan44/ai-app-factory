const token = "13|kgJTMoZUSbWScRW0rqifq13snRr9HP72Kbz0Aet428b08cdc";
const baseUrl = "https://seymata.com/api/v1";

async function test() {
  console.log("=== Querying Applications ===");
  try {
    const res = await fetch(`${baseUrl}/applications`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Applications Status:", res.status);
    const data = await res.json();
    console.log("Applications Count:", Array.isArray(data) ? data.length : "Not array");
    if (Array.isArray(data) && data.length > 0) {
      // Print first 5 applications destination details
      for (const app of data.slice(0, 5)) {
        console.log(`\nApp: ${app.name} (${app.uuid})`);
        console.log(`Destination:`, JSON.stringify(app.destination, null, 2));
      }
    }
  } catch (e) {
    console.error("Applications Error:", e);
  }
}

test();
