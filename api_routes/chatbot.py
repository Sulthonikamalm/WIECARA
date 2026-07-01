import os
from flask import Blueprint, request, jsonify, session
from groq import Groq
from db import get_db

chatbot_bp = Blueprint('chatbot', __name__)

CRISIS_KEYWORDS = [
    'bunuh diri',
    'mau mati',
    'ingin mati',
    'pengen mati',
    'akhiri hidup',
    'mengakhiri hidup',
    'gantung diri',
    'lompat',
    'loncat',
    'overdosis',
    'minum racun',
    'silet',
    'menyakiti diri',
    'nyakitin diri',
    'tidak kuat hidup',
    'gak kuat hidup',
    'capek hidup',
    'lelah hidup'
]

SELF_HARM_ACTION_WORDS = [
    'melukai',
    'lukai',
    'nyakitin',
    'menyakiti',
    'menancapkan',
    'menancap',
    'menusuk',
    'tusuk',
    'tikam',
    'menyayat',
    'sayat',
    'mengiris',
    'iris',
    'memotong',
    'potong',
    'menggorok',
    'gorok'
]

SELF_HARM_TOOL_WORDS = [
    'pisau',
    'cutter',
    'silet',
    'gunting',
    'pecahan kaca',
    'racun',
    'obat',
    'overdosis',
    'tali'
]

SELF_HARM_BODY_WORDS = [
    'diri',
    'tangan',
    'lengan',
    'leher',
    'perut',
    'dada',
    'kepala',
    'urat nadi',
    'nadi',
    'pergelangan'
]

SELF_REFERENCE_WORDS = [
    'saya',
    'aku',
    'gue',
    'gua',
    'diriku',
    'tubuhku',
    'leher saya',
    'tangan saya',
    'perut saya'
]

IMMINENT_INTENT_WORDS = [
    'mau',
    'ingin',
    'pengen',
    'akan',
    'sekarang',
    'hari ini',
    'habis ini',
    'langsung',
    'saja',
    'aja'
]

HIGH_PLACE_WORDS = [
    'gedung',
    'jembatan',
    'atap',
    'lantai atas',
    'balkon',
    'jurang'
]


# Jumlah pesan non-system terakhir yang dikirim ke Groq. conversation_history bisa
# tumbuh panjang pada percakapan lama; mengirim seluruhnya membuat payload, latensi,
# dan biaya token membengkak tanpa batas. Kita kirim system prompt + N pesan terakhir.
MAX_HISTORY_MESSAGES = 20


def _pesan_untuk_model(history):
    """Bangun payload Groq: system prompt (indeks 0) + N pesan terakhir."""
    if not history:
        return history
    has_system = history[0].get('role') == 'system'
    system = history[:1] if has_system else []
    rest = history[1:] if has_system else history
    return system + rest[-MAX_HISTORY_MESSAGES:]


def _contains_any(text, words):
    return any(word in text for word in words)


def is_self_harm_crisis(text):
    """Deteksi deterministik khusus self-harm, terpisah dari scoring laporan."""
    if _contains_any(text, CRISIS_KEYWORDS):
        return True

    has_self_reference = _contains_any(text, SELF_REFERENCE_WORDS)
    has_imminent_intent = _contains_any(text, IMMINENT_INTENT_WORDS)
    has_action = _contains_any(text, SELF_HARM_ACTION_WORDS)
    has_tool = _contains_any(text, SELF_HARM_TOOL_WORDS)
    has_body = _contains_any(text, SELF_HARM_BODY_WORDS)

    if ('lompat' in text or 'loncat' in text) and (has_imminent_intent or _contains_any(text, HIGH_PLACE_WORDS)):
        return True

    if has_self_reference and has_action and (has_tool or has_body or has_imminent_intent):
        return True

    if has_imminent_intent and has_tool and has_body:
        return True

    return False

# Client Groq dibangun malas (lazy) dan defensif: dibuat saat pertama dibutuhkan,
# bukan saat import. Tujuannya agar kegagalan SDK/koneksi tidak membuat seluruh
# server gagal start â€” chatbot cukup jatuh ke respons empatik default.
_groq_client = None
_groq_client_gagal = False


def _ambil_groq_client():
    global _groq_client, _groq_client_gagal
    if _groq_client is None and not _groq_client_gagal:
        try:
            _groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
        except Exception as e:
            print("Groq init error:", str(e))
            _groq_client_gagal = True
    return _groq_client

@chatbot_bp.route('/chat.php', methods=['POST'])
def chat():
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'Invalid JSON'}), 400

    action = data.get('action', 'chat')
    if action == 'reset':
        session.clear()
        return jsonify({'success': True, 'message': 'Session reset'})
    elif action == 'reject_offer':
        session['abuse_score'] = 0
        # Tawaran lapor ditolak: bersihkan juga flag consent agar tier/phase
        # kembali ke 'curhat'. Tanpa ini consent_given lengket True, sehingga
        # chatbot tetap dilaporkan di tier 'report' meski pengguna menolak.
        session.pop('consent_given', None)
        session.pop('needs_consent_prompt', None)
        return jsonify({'success': True, 'message': 'Score reset to 0'})

    user_message = data.get('message', '').strip()
    if not user_message and action == 'chat':
        return jsonify({'success': False, 'error': 'Message is required'}), 400
        
    text_lower = user_message.lower()

    if is_self_harm_crisis(text_lower):
        if 'session_id_unik' not in session:
            session['session_id_unik'] = 'session_' + os.urandom(8).hex()
        session['last_crisis_message'] = user_message
        return jsonify({
            'success': True,
            'response': 'ARA mendeteksi kamu mungkin sedang dalam kondisi berbahaya. Aku perlu memastikan keselamatanmu sekarang.',
            'phase': 'safety_check',
            'tier': 'emergency',
            'risk_type': 'SELF_HARM_INTENT',
            'safety_check_timeout_seconds': 20,
            'trigger_message': user_message,
            'session_id': session['session_id_unik']
        })

    system_prompt = (
        "Kamu adalah ARA, Asisten Ruang Aman dari WIECARA PPKPT Telkom University Surabaya. "
        "Berikan respons yang hangat, suportif, dan singkat. "
        "ATURAN MUTLAK: JANGAN PERNAH menyertakan tag atau kode rahasia apa pun seperti '[TAWARKAN_LAPOR]' dalam pesanmu. "
        "Tugasmu hanyalah merespons curhatan pengguna dengan empati murni dan mendengarkan keluh kesah mereka."
    )

    if 'conversation_history' not in session:
        session['conversation_history'] = [
            {"role": "system", "content": system_prompt}
        ]
        session['message_count'] = 0
        session['session_id_unik'] = 'session_' + os.urandom(8).hex()
    else:
        # Selalu perbarui system prompt di indeks 0 dengan yang terbaru, jika session sudah ada
        if len(session['conversation_history']) > 0 and session['conversation_history'][0].get('role') == 'system':
            session['conversation_history'][0]['content'] = system_prompt

    session['message_count'] += 1
    session['conversation_history'].append({"role": "user", "content": user_message})

    try:
        client = _ambil_groq_client()
        if client is None:
            raise RuntimeError("Groq client tidak tersedia")
        model_name = os.environ.get("GROQ_MODEL_PRIMARY", "llama-3.3-70b-versatile")
        completion = client.chat.completions.create(
            model=model_name,
            messages=_pesan_untuk_model(session['conversation_history']),
            temperature=0.7,
            max_tokens=500
        )
        bot_response = completion.choices[0].message.content
    except Exception as e:
        print("Groq Error:", str(e))
        bot_response = "Aku di sini mendengarkanmu. Ceritakan apa yang kamu rasakan..."

    # Inisialisasi poin
    if 'abuse_score' not in session:
        session['abuse_score'] = 0

    # Fallback logika matematis berbasis kata kunci
    explicit_lapor_keywords = ["mau lapor", "ingin lapor", "buat laporan", "bantu lapor", "mau melapor", "ingin melapor"]
    abuse_keywords = [
        "pelecehan", "dilecehkan", "kekerasan", "dipukul", "diperkosa",
        "ancam", "ancaman", "disentuh", "diraba", "diremas", "remas",
        "payudara", "dada", "kemaluan", "alat vital", "dicium paksa",
        "dipeluk paksa", "dipaksa", "memaksa"
    ]
    hesitation_keywords = ["takut", "ragu", "belum siap", "nanti", "malu", "bingung", "jangan lapor", "tidak mau lapor", "nggak mau lapor"]
    
    # Tambah poin jika ada indikasi kekerasan
    if any(w in text_lower for w in explicit_lapor_keywords):
        session['abuse_score'] = 2 # Langsung 2 poin jika eksplisit minta lapor
    elif any(w in text_lower for w in abuse_keywords):
        session['abuse_score'] += 1 # Tambah 1 poin per indikasi

    # Tawarkan laporan HANYA jika poin sudah 2 atau lebih
    if session['abuse_score'] >= 2 and not any(w in text_lower for w in hesitation_keywords):
        if "[TAWARKAN_LAPOR]" not in bot_response:
            bot_response += " [TAWARKAN_LAPOR]"

    bot_response_clean = bot_response.replace("[TAWARKAN_LAPOR]", "").strip()
    session['conversation_history'].append({"role": "assistant", "content": bot_response_clean})
    
    if "[TAWARKAN_LAPOR]" in bot_response:
        session['consent_given'] = True
        session['needs_consent_prompt'] = True
        
    # Save to DB if consent to report is detected
    if session.get('consent_given'):
        conn = get_db()
        cursor = conn.cursor()
        # Create DB session if not exists
        if 'db_session_id' not in session:
            cursor.execute('INSERT INTO ChatSession (session_id_unik) VALUES (?)', (session['session_id_unik'],))
            new_session_id = cursor.lastrowid

            # Persist history
            for msg in session['conversation_history']:
                if msg['role'] != 'system':
                    role_map = 'bot' if msg['role'] == 'assistant' else 'user'
                    cursor.execute('INSERT INTO ChatMessage (session_id, role, content) VALUES (?, ?, ?)',
                                 (new_session_id, role_map, msg['content']))
            conn.commit()
            # Tandai session di cookie hanya setelah commit sukses, agar tidak ada
            # referensi id "hantu" bila proses gagal di tengah jalan.
            session['db_session_id'] = new_session_id

    phase = 'consent' if session.pop('needs_consent_prompt', False) else ('report' if session.get('consent_given') else 'curhat')
    return jsonify({
        'success': True,
        'response': bot_response_clean,
        'phase': phase,
        'tier': 'report' if session.get('consent_given') else 'curhat',
        'score': 10 if session.get('consent_given') else 5,
        'message_count': session['message_count'],
        'session_id': session['session_id_unik'],
        'persisted': session.get('consent_given', False),
        'consent_given': session.get('consent_given', False)
    })

