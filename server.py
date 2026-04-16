import http.server
import socketserver
import json
import urllib.request
import urllib.error
import sys

PORT = 8767
import os
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

class APIServerHandler(http.server.SimpleHTTPRequestHandler):
    
    # Adicionando suporte a POST para a nossa API improvisada
    def do_POST(self):
        if self.path == '/api/generate':
            # Ler dados da requisição (ex: peso, gênero, meta)
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                user_data = json.loads(post_data.decode('utf-8'))
            except:
                user_data = {}
                
            weight = user_data.get('weight', 70)
            height = user_data.get('height', 170)
            goalWeight = user_data.get('goalWeight', 60)
            age = user_data.get('age', 30)
            gender = user_data.get('gender', 'feminino')
            body = user_data.get('body', 'não especificado')
            activityLevel = user_data.get('activityLevel', '1.2')
            goalType = user_data.get('goalType', 'perda_peso')
            
            # Contexto extra do Quiz
            context_raw = user_data.get('context', {})
            context = context_raw if isinstance(context_raw, dict) else {}
            
            goals_list = context.get('goals', [])
            goals = ", ".join(goals_list) if isinstance(goals_list, list) else ""
            
            concerns_list = context.get('concerns', [])
            concerns = ", ".join(concerns_list) if isinstance(concerns_list, list) else ""
            
            foods_list = context.get('foods', [])
            excluded_foods = ", ".join(foods_list) if isinstance(foods_list, list) else ""
            
            routine = str(context.get('routine', 'normal'))
            preferred_meals = str(context.get('meals', '3'))

            # O super "Prompt Especialista" - Agora Gerando a Semana Inteira + 3 Opções + Lista de Compras
            system_prompt = f"""
Você é um Nutricionista Especialista em Jejum Intermitente e Personal Trainer de alto nível.
Gere um Plano Semanal Completo (7 dias, de Segunda a Domingo) focado em: {'Emagrecimento Rápido' if goalType == 'perda_peso' else 'Ganho de Massa e Tonificação'}.

Contexto do Cliente:
- Perfil: {age} anos, gênero {gender}, altura {height}cm.
- Peso Atual: {weight}kg. Meta: {goalWeight}kg.
- Nível de Atividade: {activityLevel}.
- Alimentos a evitar: {excluded_foods}

Requisitos OBRIGATÓRIOS:
1. Cardápio: {preferred_meals} refeições por dia. Para CADA refeição, ofereça 3 OPÇÕES claras.
2. Treino Personalizado: Crie treinos específicos para o gênero {gender} e para o objetivo {goalType}. 
   Se for Ganho de Massa, foque em hipertrofia. Se for Perda de Peso, foque em queima calórica e HIIT.
3. Lista de Compras: Organizada para a semana.
4. Formato: JSON rigoroso.

Responda EXATAMENTE no formato JSON:
{{
  "weekly_plan": [
    {{
      "day_name": "Segunda-feira",
      "meals": [
        {{
          "type": "Refeição 1",
          "options": [
            {{"title": "Opção 1", "description": "Descrição detalhada"}},
            {{"title": "Opção 2", "description": "Descrição detalhada"}},
            {{"title": "Opção 3", "description": "Descrição detalhada"}}
          ]
        }}
        ... (gerar {preferred_meals} refeições)
      ],
      "workout": {{"title": "Título", "description": "Descrição"}}
    }},
    ... (7 dias)
  ],
  "shopping_list": [
    {{"category": "Nome da Categoria", "items": ["Item 1", "Item 2"]}}
  ]
}}
"""

            # Faz a requisição para a OpenAI (usando a biblioteca nativa do Python, sem pip install)
            req = urllib.request.Request(
                url='https://api.openai.com/v1/chat/completions',
                data=json.dumps({
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": "Gere meu plano base."}
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.5
                }).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {OPENAI_API_KEY}'
                },
                method='POST'
            )

            try:
                with urllib.request.urlopen(req) as response:
                    body = response.read()
                    data = json.loads(body.decode('utf-8'))
                    
                    # Extrai o JSON gerado pela IA
                    ai_content = data["choices"][0]["message"]["content"]
                    
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(ai_content.encode('utf-8'))
            except urllib.error.HTTPError as e:
                err_body = e.read()
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e), "details": err_body.decode()}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

        elif self.path == '/api/vision':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)

            try:
                data = json.loads(post_data.decode('utf-8'))
                base64_image = data.get('image', '')
                
                # Strip metadata header if present (ex: "data:image/jpeg;base64,...")
                if "base64," in base64_image:
                    base64_image = base64_image.split("base64,")[1]

                vision_prompt = "Você é um contador de calorias especialista. Olhe para a foto e estime o número de calorias totais e o nome do prato. Retorne APENAS um JSON no formato: {\"calories\": 500, \"name\": \"Nome do Prato\"}. Não escreva nenhum texto antes ou depois, sem crases na resposta."

                req = urllib.request.Request(
                    url='https://api.openai.com/v1/chat/completions',
                    data=json.dumps({
                        "model": "gpt-4o-mini",
                        "messages": [
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": vision_prompt},
                                    {
                                        "type": "image_url",
                                        "image_url": {
                                            "url": f"data:image/jpeg;base64,{base64_image}",
                                            "detail": "low"
                                        }
                                    }
                                ]
                            }
                        ],
                        "temperature": 0.3
                    }).encode('utf-8'),
                    headers={
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {OPENAI_API_KEY}'
                    },
                    method='POST'
                )

                with urllib.request.urlopen(req) as response:
                    body = response.read()
                    data = json.loads(body.decode('utf-8'))
                    ai_content = data["choices"][0]["message"]["content"]
                    
                    # Clean the AI content if it has markdown backticks
                    if ai_content.startswith("```"):
                        ai_content = ai_content.strip("```json").strip("```").strip()

                    print(f"Vision AI Output: {ai_content}")
                    
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(ai_content.encode('utf-8'))

            except urllib.error.HTTPError as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": "OpenAI Error", "details": e.read().decode()}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        
        elif self.path == '/api/generate-workout':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            user_data = json.loads(post_data.decode('utf-8'))
            
            gender = user_data.get('gender', 'feminino')
            goal = user_data.get('goal', 'perda_peso')
            days = user_data.get('days', '3')
            level = user_data.get('level', 'iniciante')

            system_prompt = f"""
            Você é um Personal Trainer de elite. Gere um cronograma de treino semanal personalizado.
            Objetivo: {'Queima Calórica' if goal == 'perda_peso' else 'Ganho de Massa'}.
            Frequência: {days} dias por semana.
            Nível: {level}. Gênero: {gender}.
            Retorne APENAS um JSON no formato:
            {{
              "workout_plan": [
                {{ "day": "Segunda-feira", "focus": "Foco", "title": "Treino", "description": "Detalhes" }}
              ]
            }} (para 7 dias)
            """

            req = urllib.request.Request(
                url='https://api.openai.com/v1/chat/completions',
                data=json.dumps({
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "system", "content": system_prompt}],
                    "response_format": {"type": "json_object"}
                }).encode('utf-8'),
                headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {OPENAI_API_KEY}'},
                method='POST'
            )

            try:
                with urllib.request.urlopen(req) as response:
                    ai_content = response.read().decode('utf-8')
                    ai_data = json.loads(ai_content)
                    final_json = ai_data["choices"][0]["message"]["content"]
                    
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(final_json.encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        
        else:
            self.send_response(404)
            self.end_headers()

with socketserver.TCPServer(("", PORT), APIServerHandler) as httpd:
    print(f"Servidor backend (com Inteligência Artificial) rodando na porta {PORT}...")
    httpd.serve_forever()
