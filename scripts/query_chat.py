import os
import sys
import json

# Save real stdout and redirect stdout -> stderr to prevent any print pollution
real_stdout = sys.stdout
sys.stdout = sys.stderr

if hasattr(real_stdout, 'reconfigure'):
    real_stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')
if hasattr(sys.stdin, 'reconfigure'):
    sys.stdin.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from server import query_rag_context, call_gemini_chat, load_env

load_env()

def main():
    try:
        user_message = ""
        history = []

        # 1. First priority: CLI argument
        if len(sys.argv) > 1:
            user_message = " ".join(sys.argv[1:]).strip()

        # 2. Second priority: Stdin JSON payload
        if not user_message and not sys.stdin.isatty():
            try:
                raw_stdin = sys.stdin.read().strip()
                if raw_stdin:
                    payload = json.loads(raw_stdin)
                    user_message = payload.get("message", "").strip()
                    history = payload.get("history", [])
            except Exception as e:
                sys.stderr.write(f"[query_chat] Error parsing stdin JSON: {e}\n")

        if not user_message:
            res_err = json.dumps({"error": "No user message provided"}, ensure_ascii=False)
            real_stdout.write(res_err + "\n")
            real_stdout.flush()
            return

        rag_context, rec_products = query_rag_context(user_message, limit=5)
        gemini_res = call_gemini_chat(user_message, history, rag_context)

        response_payload = {
            "answer": gemini_res.get("answer", ""),
            "recommendedProducts": rec_products,
            "noApiKey": gemini_res.get("noApiKey", False)
        }
        res_json = json.dumps(response_payload, ensure_ascii=False)
        real_stdout.write(res_json + "\n")
        real_stdout.flush()
    except Exception as e:
        res_err = json.dumps({"error": str(e)}, ensure_ascii=False)
        real_stdout.write(res_err + "\n")
        real_stdout.flush()

if __name__ == "__main__":
    main()
