const token = "13|kgJTMoZUSbWScRW0rqifq13snRr9HP72Kbz0Aet428b08cdc";
const baseUrl = "https://seymata.com/api/v1";

async function test() {
  console.log("=== Querying Projects ===");
  try {
    const res = await fetch(`${baseUrl}/projects`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Projects Status:", res.status);
    const data = await res.json();
    console.log("Projects Response:");
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Projects Error:", e);
  }

  console.log("\n=== Querying Servers ===");
  try {
    const res = await fetch(`${baseUrl}/servers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (Array.isArray(data)) {
      for (const server of data) {
        console.log(`Server: ${server.name} (${server.uuid})`);
        // Query server details if possible
        try {
          const detailRes = await fetch(`${baseUrl}/servers/${server.uuid}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const detailData = await detailRes.json();
          console.log(`Server Details for ${server.uuid}:`);
          console.log(JSON.stringify(detailData, null, 2));
        } catch (e) {
          console.error("Server Detail Error:", e);
        }
      }
    }
  } catch (e) {
    console.error("Servers Error:", e);
  }
}

test();
