
// Create Offer
const CreateEphermeralToken = async (req, res) => {
  const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-realtime-preview-2024-12-17",
      voice: "verse",
    }),
  });
  const data = await r.json();
  console.log("Ephermeral token:", data);
  // Send back the JSON we received from the OpenAI REST API
  return res.json(data);
};



export { CreateEphermeralToken };