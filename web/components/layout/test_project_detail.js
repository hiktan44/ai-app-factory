const token = "13|kgJTMoZUSbWScRW0rqifq13snRr9HP72Kbz0Aet428b08cdc";
const baseUrl = "https://seymata.com/api/v1";
const projectUuid = "ce0ih9q54ua6f5d6ygpr99h8"; // ai-app-factory

async function test() {
  console.log("=== Querying Project Detail ===");
  try {
    const res = await fetch(`${baseUrl}/projects/${projectUuid}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Project Status:", res.status);
    const data = await res.json();
    console.log("Project Details:");
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Project Detail Error:", e);
  }
}

test();
