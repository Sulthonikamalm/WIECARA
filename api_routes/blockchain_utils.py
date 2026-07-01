"""
Blockchain utility: record_block function.
Separated from the blueprint to avoid circular imports.
"""
import hashlib
import json
import time
from db import get_db


def calculate_hash(block_index, timestamp, action_type, actor_role, actor_id, laporan_id, data_payload, previous_hash):
    """Calculate SHA-256 hash for a block."""
    block_string = f"{block_index}{timestamp}{action_type}{actor_role}{actor_id}{laporan_id}{data_payload}{previous_hash}"
    return hashlib.sha256(block_string.encode('utf-8')).hexdigest()


def record_block(action_type, actor_role, actor_id, laporan_id, data_payload, existing_conn=None):
    """
    Record a new block to the blockchain ledger.
    
    Args:
        action_type: e.g. 'LAPORAN_BARU', 'STATUS_UPDATE', 'CATATAN_PSIKOLOG', etc.
        actor_role: 'system', 'user', 'admin', 'psikolog', 'legal'
        actor_id: ID of the actor
        laporan_id: ID of the related report (can be None)
        data_payload: dict of the data being recorded
        existing_conn: An existing sqlite3 connection to use for atomic transactions
    """
    try:
        conn = existing_conn if existing_conn else get_db()
        
        last_block = conn.execute(
            'SELECT block_index, hash FROM BlockchainLedger ORDER BY id DESC LIMIT 1'
        ).fetchone()
        
        if last_block:
            new_index = last_block['block_index'] + 1
            previous_hash = last_block['hash']
        else:
            new_index = 0
            previous_hash = '0' * 64
        
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
        payload_json = json.dumps(data_payload, ensure_ascii=False, default=str)
        
        new_hash = calculate_hash(
            new_index, timestamp, action_type, actor_role, actor_id, 
            laporan_id, payload_json, previous_hash
        )
        
        conn.execute('''
            INSERT INTO BlockchainLedger (block_index, timestamp, action_type, actor_role, actor_id, laporan_id, data_payload, previous_hash, hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (new_index, timestamp, action_type, actor_role, actor_id, laporan_id, payload_json, previous_hash, new_hash))
        
        if not existing_conn:
            conn.commit()
        
    except Exception as e:
        print(f"[Blockchain] Error recording block: {e}")
