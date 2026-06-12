import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load env variables (assuming .env is in backend or frontend)
load_dotenv('../frontend/.env')

url: str = os.environ.get("VITE_SUPABASE_URL")
key: str = os.environ.get("VITE_SUPABASE_ANON_KEY")

supabase: Client = None
if url and key:
    supabase = create_client(url, key)
else:
    print("WARNING: Supabase URL or Key not found in environment variables.")
