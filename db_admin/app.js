document.addEventListener('DOMContentLoaded', () => {
    const tableList = document.getElementById('tableList');
    const dataHead = document.getElementById('dataHead');
    const dataBody = document.getElementById('dataBody');
    const currentViewTitle = document.getElementById('currentViewTitle');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const emptyState = document.getElementById('emptyState');
    const queryPanel = document.getElementById('queryPanel');
    const sqlQueryInput = document.getElementById('sqlQueryInput');
    const queryStatus = document.getElementById('queryStatus');
    const toast = document.getElementById('toast');

    let currentTable = null;

    // Initialize
    fetchTables();

    // Event Listeners
    document.getElementById('btnRefresh').addEventListener('click', () => {
        if (currentTable) {
            loadTableData(currentTable);
        } else {
            fetchTables();
        }
    });

    document.getElementById('btnResetDb').addEventListener('click', async () => {
        if (confirm('PERINGATAN BAHAYA!\n\nApakah Anda yakin ingin MENGHAPUS SEMUA DATA TRANSAKSI (Laporan, Bukti, Jadwal, Catatan, History, Blockchain)?\n\nData akun User/Admin/Psikolog/Legal tidak akan dihapus. Tindakan ini tidak dapat dibatalkan!')) {
            loadingOverlay.style.display = 'flex';
            try {
                const res = await fetch('/api/db_admin/reset_data', { method: 'POST' });
                const data = await res.json();
                if (data.status === 'success') {
                    showToast(data.message, 'success');
                    if (currentTable) loadTableData(currentTable);
                } else {
                    showToast('Error: ' + data.message, 'error');
                }
            } catch (err) {
                showToast('Failed to reset data', 'error');
            } finally {
                loadingOverlay.style.display = 'none';
            }
        }
    });

    document.getElementById('btnRunQuery').addEventListener('click', () => {
        queryPanel.style.display = queryPanel.style.display === 'none' ? 'block' : 'none';
        if(queryPanel.style.display === 'block') sqlQueryInput.focus();
    });

    document.getElementById('btnCloseQuery').addEventListener('click', () => {
        queryPanel.style.display = 'none';
    });

    document.getElementById('btnExecuteQuery').addEventListener('click', executeQuery);

    // API Calls
    async function fetchTables() {
        try {
            const res = await fetch('/api/db_admin/tables');
            const data = await res.json();
            
            if (data.status === 'success') {
                renderTableList(data.data);
            } else {
                showToast(data.message, 'error');
            }
        } catch (error) {
            showToast('Failed to fetch tables', 'error');
            console.error(error);
        }
    }

    async function loadTableData(tableName) {
        currentTable = tableName;
        loadingOverlay.style.display = 'flex';
        emptyState.style.display = 'none';
        currentViewTitle.innerHTML = `<i class="fas fa-table"></i> ${tableName}`;
        
        // Update active class in sidebar
        document.querySelectorAll('.table-list li').forEach(li => {
            if (li.dataset.table === tableName) li.classList.add('active');
            else li.classList.remove('active');
        });

        try {
            const res = await fetch(`/api/db_admin/table_data?table=${tableName}`);
            const data = await res.json();
            
            if (data.status === 'success') {
                renderTable(data.data.columns, data.data.rows);
            } else {
                showToast(data.message, 'error');
            }
        } catch (error) {
            showToast('Failed to load table data', 'error');
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }

    async function executeQuery() {
        const query = sqlQueryInput.value.trim();
        if (!query) {
            showToast('Please enter a query', 'error');
            return;
        }

        queryStatus.textContent = 'Executing...';
        queryStatus.style.color = '#6b7280';
        loadingOverlay.style.display = 'flex';

        try {
            const res = await fetch('/api/db_admin/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            const data = await res.json();
            
            if (data.status === 'success') {
                if (data.data) {
                    // It was a SELECT query
                    renderTable(data.data.columns, data.data.rows);
                    currentViewTitle.innerHTML = `<i class="fas fa-terminal"></i> Query Results`;
                    currentTable = null;
                    // Remove active class from sidebar
                    document.querySelectorAll('.table-list li').forEach(li => li.classList.remove('active'));
                }
                
                queryStatus.textContent = data.message || `Query executed successfully`;
                queryStatus.style.color = 'var(--success-color)';
                showToast('Success', 'success');
                
                // If it was an INSERT/UPDATE/DELETE and we were viewing a table, we might want to refresh
                if (currentTable && !query.toLowerCase().startsWith('select')) {
                    setTimeout(() => loadTableData(currentTable), 1000);
                }
            } else {
                queryStatus.textContent = 'Error: ' + data.message;
                queryStatus.style.color = 'var(--danger-color)';
                showToast(data.message, 'error');
            }
        } catch (error) {
            queryStatus.textContent = 'Network error';
            queryStatus.style.color = 'var(--danger-color)';
            showToast('Execution failed', 'error');
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }

    // UI Rendering
    function renderTableList(tables) {
        tableList.innerHTML = '';
        if (tables.length === 0) {
            tableList.innerHTML = '<li style="color:#9ca3af;cursor:default;">No tables found</li>';
            return;
        }

        tables.forEach(table => {
            const li = document.createElement('li');
            li.dataset.table = table;
            li.innerHTML = `<i class="fas fa-list"></i> ${table}`;
            li.addEventListener('click', () => loadTableData(table));
            tableList.appendChild(li);
        });
    }

    function renderTable(columns, rows) {
        dataHead.innerHTML = '';
        dataBody.innerHTML = '';

        if (!columns || columns.length === 0) {
            emptyState.style.display = 'flex';
            return;
        }

        // Render Headers
        const headerRow = document.createElement('tr');
        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            headerRow.appendChild(th);
        });
        dataHead.appendChild(headerRow);

        // Render Rows
        if (!rows || rows.length === 0) {
            emptyState.style.display = 'flex';
            return;
        }

        rows.forEach(row => {
            const tr = document.createElement('tr');
            columns.forEach(col => {
                const td = document.createElement('td');
                const val = row[col];
                
                if (val === null) {
                    td.textContent = 'NULL';
                    td.classList.add('null-value');
                } else if (typeof val === 'object') {
                    td.textContent = JSON.stringify(val);
                } else {
                    td.textContent = val;
                }
                
                // Add title for hover tooltip on long text
                if (String(val).length > 30) {
                    td.title = val;
                }
                
                tr.appendChild(td);
            });
            dataBody.appendChild(tr);
        });
    }

    function showToast(message, type = 'success') {
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
});
