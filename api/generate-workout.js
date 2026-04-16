export default async function handler(req, res) {
  // Habilitar CORS
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
    const { gender, goal, weight, height, days, level } = req.body;
    let apiKey = process.env.OPENAI_API_KEY;

    // Fallback: Tenta buscar a chave salva no Painel Admin (Firestore)
    if (!apiKey) {
      try {
        const fbRes = await fetch("https://firestore.googleapis.com/v1/projects/app-jejum-emagrecimento/databases/(default)/documents/config/global");
        const fbData = await fbRes.json();
        if (fbData?.fields?.openai_key?.stringValue) {
          apiKey = fbData.fields.openai_key.stringValue;
        }
      } catch (err) {
        console.warn("Falha ao ler chave do Firebase:", err.message);
      }
    }

    if (!apiKey) {
      return res.status(500).json({ error: 'Chave da OpenAI não configurada.' });
    }

    const systemPrompt = `
      Você é um Personal Trainer de elite. Gere um cronograma de treino semanal personalizado.
      Objetivo: ${goal === 'perda_peso' ? 'Queima Calórica e Definição' : 'Ganho de Massa Muscular'}.
      Frequência: ${days} dias por semana.
      Nível: ${level}.
      Gênero: ${gender}.
      
      Instruções:
      1. Se o usuário treina X dias, os outros dias devem ser marcados como "Descanso Ativo" (ex: caminhada leve ou alongamento).
      2. Forneça o foco do dia (ex: Inferiores, Cardio, Superior).
      
      Retorne APENAS um JSON no formato:
      {
        "workout_plan": [
          {
            "day": "Segunda-feira",
            "focus": "Foco do dia",
            "title": "Nome do Treino",
            "description": "Lista de exercícios com séries e repetições."
          },
          ... (7 dias)
        ]
      }
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Crie meu cronograma de 7 dias." }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (!data.choices || !data.choices[0]) {
       return res.status(500).json({ error: 'Erro na resposta da OpenAI', details: data });
    }

    let rawContent = data.choices[0].message.content;
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("A IA não retornou um formato JSON válido.");
    
    const aiContent = JSON.parse(jsonMatch[0]);
    res.status(200).json(aiContent);

  } catch (error) {
    console.error("Workout Generator Error:", error);
    res.status(500).json({ error: error.message });
  }
}
