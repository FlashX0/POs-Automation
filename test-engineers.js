async function run() {
  try {
    // 1. Create engineer
    const newId = "test-eng-123";
    const engData = {
      id: newId,
      name: "Test Engineer 1",
      phone: "010000",
      project: "Proj A",
      code: "ENG-123",
      initialBalance: 0,
      updatedAt: new Date().toISOString()
    };
    
    console.log("Creating engineer...");
    let res = await fetch('http://localhost:3000/api/state/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engineers: [engData] })
    });
    console.log("Create response:", res.status);
    
    // 2. Edit engineer
    console.log("Editing engineer...");
    engData.name = "Test Engineer 1 Edited";
    res = await fetch('http://localhost:3000/api/state/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engineers: [engData] })
    });
    console.log("Edit response:", res.status);
    
    // 3. Delete engineer
    console.log("Deleting engineer...");
    res = await fetch('http://localhost:3000/api/engineers/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newId, name: "Test Engineer 1 Edited" })
    });
    console.log("Delete response:", res.status);
    const delData = await res.json();
    console.log("Delete result:", delData);
    
    // 4. Refresh to check if it's really deleted
    console.log("Refreshing data...");
    res = await fetch('http://localhost:3000/api/financial-data');
    const state = await res.json();
    const hasEngineer = state.engineers?.some(e => e.id === newId);
    console.log("Engineer still exists in state?", hasEngineer);
    
  } catch (err) {
    console.error(err);
  }
}
run();
