"""
Blockchain Simulation Module for WIECARA PPKPT
=============================================
Simulates an immutable blockchain ledger for tracking ALL system actions.
Each block contains a SHA-256 hash derived from its data + the previous block's hash,
creating a tamper-evident chain of custody for every report and action.
"""

import hashlib
import json
import time
from flask import Blueprint, jsonify, request
from db import get_db

blockchain_bp = Blueprint('blockchain', __name__)


from api_routes.blockchain_utils import calculate_hash


# ========== API ROUTES ==========

@blockchain_bp.route('/get_chain.php', methods=['GET'])
def get_chain():
    """Get the full blockchain chain or filter by laporan_id."""
    conn = get_db()
    
    laporan_id = request.args.get('laporan_id')
    search = request.args.get('search', '').strip()
    
    if laporan_id:
        blocks = conn.execute(
            'SELECT * FROM BlockchainLedger WHERE laporan_id = ? ORDER BY block_index ASC',
            (laporan_id,)
        ).fetchall()
    elif search:
        blocks = conn.execute(
            "SELECT * FROM BlockchainLedger WHERE data_payload LIKE ? ORDER BY block_index ASC",
            (f'%{search}%',)
        ).fetchall()
    else:
        blocks = conn.execute(
            'SELECT * FROM BlockchainLedger ORDER BY block_index ASC'
        ).fetchall()
    
    chain = []
    for b in blocks:
        chain.append({
            'id': b['id'],
            'block_index': b['block_index'],
            'timestamp': b['timestamp'],
            'action_type': b['action_type'],
            'actor_role': b['actor_role'],
            'actor_id': b['actor_id'],
            'laporan_id': b['laporan_id'],
            'data_payload': b['data_payload'],
            'previous_hash': b['previous_hash'],
            'hash': b['hash']
        })
    
    return jsonify({
        'status': 'success',
        'data': {
            'chain': chain,
            'length': len(chain)
        }
    })


@blockchain_bp.route('/validate_chain.php', methods=['GET'])
def validate_chain():
    """Validate the integrity of the entire blockchain. Returns broken blocks if any."""
    conn = get_db()
    blocks = conn.execute('SELECT * FROM BlockchainLedger ORDER BY block_index ASC').fetchall()
    
    if not blocks:
        return jsonify({'status': 'success', 'data': {'valid': True, 'message': 'Chain kosong, belum ada blok.', 'total_blocks': 0, 'broken_blocks': []}})
    
    broken = []
    
    for i, block in enumerate(blocks):
        # Recalculate hash
        expected_hash = calculate_hash(
            block['block_index'], block['timestamp'], block['action_type'],
            block['actor_role'], block['actor_id'], block['laporan_id'],
            block['data_payload'], block['previous_hash']
        )
        
        if expected_hash != block['hash']:
            broken.append({
                'block_index': block['block_index'],
                'reason': 'Hash tidak cocok — data pada blok ini mungkin telah dimanipulasi.',
                'expected_hash': expected_hash,
                'actual_hash': block['hash']
            })
        
        # Check chain linkage (except genesis)
        if i > 0:
            prev_block = blocks[i - 1]
            if block['previous_hash'] != prev_block['hash']:
                broken.append({
                    'block_index': block['block_index'],
                    'reason': f"Previous hash tidak cocok dengan hash blok #{prev_block['block_index']} — rantai terputus.",
                    'expected_prev': prev_block['hash'],
                    'actual_prev': block['previous_hash']
                })
    
    is_valid = len(broken) == 0
    
    return jsonify({
        'status': 'success',
        'data': {
            'valid': is_valid,
            'message': 'Semua blok valid. Tidak ada manipulasi data terdeteksi.' if is_valid else f'PERINGATAN: Ditemukan {len(broken)} anomali pada rantai blok!',
            'total_blocks': len(blocks),
            'broken_blocks': broken
        }
    })


@blockchain_bp.route('/get_stats.php', methods=['GET'])
def get_stats():
    """Get blockchain statistics."""
    conn = get_db()
    
    total = conn.execute('SELECT COUNT(*) FROM BlockchainLedger').fetchone()[0]
    
    by_action = conn.execute('''
        SELECT action_type, COUNT(*) as count 
        FROM BlockchainLedger 
        GROUP BY action_type 
        ORDER BY count DESC
    ''').fetchall()
    
    by_role = conn.execute('''
        SELECT actor_role, COUNT(*) as count 
        FROM BlockchainLedger 
        GROUP BY actor_role 
        ORDER BY count DESC
    ''').fetchall()
    
    latest = conn.execute('SELECT * FROM BlockchainLedger ORDER BY id DESC LIMIT 1').fetchone()
    
    return jsonify({
        'status': 'success',
        'data': {
            'total_blocks': total,
            'by_action': [{'action': r['action_type'], 'count': r['count']} for r in by_action],
            'by_role': [{'role': r['actor_role'], 'count': r['count']} for r in by_role],
            'latest_hash': latest['hash'] if latest else None,
            'chain_height': latest['block_index'] if latest else -1
        }
    })
