// Global variables
let charts = {};
let currentData = null;

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', async () => {
    checkHealth();
    await loadMetrics();

    // Event listeners
    document.getElementById('refreshBtn').addEventListener('click', loadMetrics);
    document.getElementById('dateRange').addEventListener('change', loadMetrics);
});

// Check API health
async function checkHealth() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();

        const statusEl = document.getElementById('healthStatus');
        if (data.configured) {
            statusEl.textContent = `✓ ${data.organization}に接続済み`;
            statusEl.className = 'health-status ok';
        } else {
            statusEl.textContent = '✗ 設定が必要です';
            statusEl.className = 'health-status error';
        }
    } catch (error) {
        console.error('Health check failed:', error);
    }
}

// Load metrics data
async function loadMetrics() {
    showLoading(true);
    hideError();

    try {
        const days = document.getElementById('dateRange').value;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const until = new Date().toISOString().split('T')[0];

        // Fetch usage and seats data
        const [usageResponse, seatsResponse] = await Promise.all([
            fetch(`/api/metrics/usage?since=${since}&until=${until}`),
            fetch('/api/metrics/seats')
        ]);

        if (!usageResponse.ok) {
            throw new Error(`Usage API error: ${usageResponse.status}`);
        }

        const usageData = await usageResponse.json();
        currentData = usageData;

        let seatsData = null;
        if (seatsResponse.ok) {
            seatsData = await seatsResponse.json();
        }

        // Update UI
        updateStats(usageData, seatsData);
        updateCharts(usageData);
        updateBreakdownTable(usageData);

    } catch (error) {
        console.error('Error loading metrics:', error);
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

// Update statistics cards
function updateStats(usageData, seatsData) {
    if (!usageData || usageData.length === 0) {
        return;
    }

    // Calculate total active users
    const uniqueUsers = new Set();
    usageData.forEach(day => {
        day.breakdown?.forEach(item => {
            if (item.total_active_users) {
                uniqueUsers.add(item.total_active_users);
            }
        });
    });

    // Calculate total suggestions and acceptances
    let totalSuggestions = 0;
    let totalAcceptances = 0;

    usageData.forEach(day => {
        day.breakdown?.forEach(item => {
            totalSuggestions += item.total_suggestions_count || 0;
            totalAcceptances += item.total_acceptances_count || 0;
        });
    });

    const acceptanceRate = totalSuggestions > 0
        ? ((totalAcceptances / totalSuggestions) * 100).toFixed(1)
        : 0;

    // Update DOM
    document.getElementById('totalUsers').textContent = usageData.reduce((sum, day) => sum + (day.total_active_users || 0), 0);
    document.getElementById('totalSuggestions').textContent = totalSuggestions.toLocaleString();
    document.getElementById('acceptanceRate').textContent = `${acceptanceRate}%`;
    document.getElementById('totalSeats').textContent = seatsData?.total_seats || '-';
}

// Update charts
function updateCharts(usageData) {
    if (!usageData || usageData.length === 0) {
        return;
    }

    // Prepare data
    const dates = usageData.map(d => new Date(d.day).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }));
    const activeUsers = usageData.map(d => d.total_active_users || 0);

    // Calculate daily suggestions and acceptances
    const dailySuggestions = usageData.map(day => {
        return day.breakdown?.reduce((sum, item) => sum + (item.total_suggestions_count || 0), 0) || 0;
    });

    const dailyAcceptances = usageData.map(day => {
        return day.breakdown?.reduce((sum, item) => sum + (item.total_acceptances_count || 0), 0) || 0;
    });

    // Aggregate language data
    const languageMap = {};
    const editorMap = {};

    usageData.forEach(day => {
        day.breakdown?.forEach(item => {
            if (item.language) {
                languageMap[item.language] = (languageMap[item.language] || 0) + (item.total_suggestions_count || 0);
            }
            if (item.editor) {
                editorMap[item.editor] = (editorMap[item.editor] || 0) + (item.total_suggestions_count || 0);
            }
        });
    });

    // Update Active Users Chart
    updateChart('activeUsersChart', {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'アクティブユーザー',
                data: activeUsers,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        }
    });

    // Update Suggestions Chart
    updateChart('suggestionsChart', {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [
                {
                    label: '提案数',
                    data: dailySuggestions,
                    backgroundColor: 'rgba(102, 126, 234, 0.7)'
                },
                {
                    label: '受け入れ数',
                    data: dailyAcceptances,
                    backgroundColor: 'rgba(118, 75, 162, 0.7)'
                }
            ]
        }
    });

    // Update Language Chart
    const topLanguages = Object.entries(languageMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    updateChart('languageChart', {
        type: 'doughnut',
        data: {
            labels: topLanguages.map(l => l[0]),
            datasets: [{
                data: topLanguages.map(l => l[1]),
                backgroundColor: [
                    '#667eea', '#764ba2', '#f093fb', '#4facfe',
                    '#43e97b', '#fa709a', '#30cfd0', '#a8edea',
                    '#ff9a9e', '#fecfef'
                ]
            }]
        }
    });

    // Update Editor Chart
    const topEditors = Object.entries(editorMap)
        .sort((a, b) => b[1] - a[1]);

    updateChart('editorChart', {
        type: 'pie',
        data: {
            labels: topEditors.map(e => e[0]),
            datasets: [{
                data: topEditors.map(e => e[1]),
                backgroundColor: [
                    '#667eea', '#764ba2', '#f093fb', '#4facfe',
                    '#43e97b', '#fa709a'
                ]
            }]
        }
    });
}

// Helper function to update or create chart
function updateChart(canvasId, config) {
    const ctx = document.getElementById(canvasId);

    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'bottom'
            }
        }
    };

    charts[canvasId] = new Chart(ctx, {
        ...config,
        options: { ...defaultOptions, ...config.options }
    });
}

// Update breakdown table
function updateBreakdownTable(usageData) {
    if (!usageData || usageData.length === 0) {
        return;
    }

    const tableContainer = document.getElementById('breakdownTable');

    // Aggregate breakdown data
    const breakdownMap = {};

    usageData.forEach(day => {
        day.breakdown?.forEach(item => {
            const key = `${item.language || 'unknown'}-${item.editor || 'unknown'}`;
            if (!breakdownMap[key]) {
                breakdownMap[key] = {
                    language: item.language || 'unknown',
                    editor: item.editor || 'unknown',
                    suggestions: 0,
                    acceptances: 0
                };
            }
            breakdownMap[key].suggestions += item.total_suggestions_count || 0;
            breakdownMap[key].acceptances += item.total_acceptances_count || 0;
        });
    });

    const breakdownData = Object.values(breakdownMap)
        .sort((a, b) => b.suggestions - a.suggestions)
        .slice(0, 20);

    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>言語</th>
                    <th>エディタ</th>
                    <th>提案数</th>
                    <th>受け入れ数</th>
                    <th>受け入れ率</th>
                </tr>
            </thead>
            <tbody>
    `;

    breakdownData.forEach(item => {
        const rate = item.suggestions > 0
            ? ((item.acceptances / item.suggestions) * 100).toFixed(1)
            : 0;

        tableHTML += `
            <tr>
                <td>${item.language}</td>
                <td>${item.editor}</td>
                <td>${item.suggestions.toLocaleString()}</td>
                <td>${item.acceptances.toLocaleString()}</td>
                <td>${rate}%</td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table>';
    tableContainer.innerHTML = tableHTML;
}

// UI helper functions
function showLoading(show) {
    document.getElementById('loadingMessage').style.display = show ? 'block' : 'none';
}

function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = `エラー: ${message}`;
    errorEl.style.display = 'block';
}

function hideError() {
    document.getElementById('errorMessage').style.display = 'none';
}
