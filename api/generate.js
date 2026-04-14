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
    const userData = req.body;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Chave da OpenAI não configurada no Vercel.' });
    }

    const weight = userData.weight || 70;
    const height = userData.height || 170;
    const goalWeight = userData.goalWeight || 60;
    const age = userData.age || 30;
    const gender = userData.gender || 'feminino';
    const body = userData.body || 'não especificado';
    const activityLevel = userData.activityLevel || '1.2';
    
    const context = userData.context || {};
    const goals = (context.goals || []).join(", ");
    const concerns = (context.concerns || []).join(", ");
    const excluded_foods = (context.foods || []).join(", ");
    const routine = context.routine || 'normal';
    const preferred_meals = context.meals || '3';

    const systemPrompt = `
      Você é um Nutricionista Especialista em Jejum Intermitente e Personal Trainer de alto nível.
      Gere um Plano Semanal Completo (7 dias, de Segunda a Domingo) focado em emagrecimento rápido e saudável.
      
      Contexto do Cliente:
      - Perfil: ${age} anos, gênero ${gender}, altura ${height}cm.
      - Peso Atual: ${weight}kg. Meta: ${goalWeight}kg.
      - Objetivos: ${goals}
      - Preocupações: ${concerns}
      - Alimentos a evitar/restrições: ${excluded_foods}
      - Rotina diária: ${routine}
      - Número de refeições preferido: ${preferred_meals}
      - Foco corporal: ${body}
      - Nível de Atividade: ${activityLevel}.
      
      Requisitos:
      1. Cardápio: ${preferred_meals} refeições por dia. Cada refeição com 3 OPÇÕES claras.
      2. Lista de Compras: Lista consolidada por categorias para a semana.
      3. Treino: Exercícios para os 7 dias focando em "${body}".
      4. Formato: JSON rigoroso.
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
          { role: "user", content: "Gere meu plano base." }
        ],
        response_format: { type: "json_object" },
        temperature: 0.5
      })
    });

    const data = await response.json();
    const aiContent = data.choices[0].message.content;
    
    return res.status(200).send(aiContent);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
