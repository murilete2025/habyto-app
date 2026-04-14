export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { image } = req.body;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Chave da OpenAI não configurada.' });
    }

    if (image.includes("base64,")) {
      image = image.split("base64,")[1];
    }

    const visionPrompt = "Você é um contador de calorias especialista. Olhe para a foto e estime o número de calorias totais e o nome do prato. Retorne APENAS um JSON no formato: {\"calories\": 500, \"name\": \"Nome do Prato\"}.";

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: visionPrompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${image}`,
                  detail: "low"
                }
              }
            ]
          }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();
    let aiContent = data.choices[0].message.content;
    
    // Limpar markdown se a IA colocar
    if (aiContent.startsWith("```")) {
      aiContent = aiContent.replace(/```json|```/g, "").trim();
    }

    return res.status(200).send(aiContent);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
