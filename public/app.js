const { createApp } = Vue;

createApp({
    data() {
        return {
            loading: false,
            errorMessage: '',
            selectedDays: 28,
            healthStatus: {
                configured: false,
                organization: '',
                enterprise: ''
            },
            stats: {
                totalUsers: '-',
                totalSuggestions: 0,
                acceptanceRate: '-',
                totalSeats: '-'
            },
            breakdownData: [],
            charts: {}
        };
    },

    mounted() {
        this.checkHealth();
        this.loadMetrics();
    },

    methods: {
        async checkHealth() {
            try {
                const response = await fetch('/api/health');
                this.healthStatus = await response.json();
            } catch (error) {
                console.error('Health check failed:', error);
            }
        },

        async loadMetrics() {
            this.loading = true;
            this.errorMessage = '';

            try {
                const since = new Date(Date.now() - this.selectedDays * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split('T')[0];
                const until = new Date().toISOString().split('T')[0];

                const [usageResponse, seatsResponse] = await Promise.all([
                    fetch(`/api/metrics/usage?since=${since}&until=${until}`),
                    fetch('/api/metrics/seats')
                ]);

                if (!usageResponse.ok) {
                    const errorData = await usageResponse.json();
                    throw new Error(errorData.detail || `API error: ${usageResponse.status}`);
                }

                const usageData = await usageResponse.json();
                let seatsData = null;

                if (seatsResponse.ok) {
                    seatsData = await seatsResponse.json();
                }

                this.updateStats(usageData, seatsData);
                this.updateCharts(usageData);
                this.updateBreakdownTable(usageData);

            } catch (error) {
                console.error('Error loading metrics:', error);
                this.errorMessage = `エラー: ${error.message}`;
            } finally {
                this.loading = false;
            }
        },

        updateStats(usageData, seatsData) {
            if (!usageData || usageData.length === 0) {
                return;
            }

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

            this.stats = {
                totalUsers: usageData.reduce((sum, day) => sum + (day.total_active_users || 0), 0),
                totalSuggestions,
                acceptanceRate,
                totalSeats: seatsData?.total_seats || '-'
            };
        },

        updateCharts(usageData) {
            if (!usageData || usageData.length === 0) {
                return;
            }

            const dates = usageData.map(d =>
                new Date(d.day).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
            );
            const activeUsers = usageData.map(d => d.total_active_users || 0);

            const dailySuggestions = usageData.map(day =>
                day.breakdown?.reduce((sum, item) => sum + (item.total_suggestions_count || 0), 0) || 0
            );

            const dailyAcceptances = usageData.map(day =>
                day.breakdown?.reduce((sum, item) => sum + (item.total_acceptances_count || 0), 0) || 0
            );

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

            // Active Users Chart
            this.createChart('activeUsersChart', {
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

            // Suggestions Chart
            this.createChart('suggestionsChart', {
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

            // Language Chart
            const topLanguages = Object.entries(languageMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            this.createChart('languageChart', {
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

            // Editor Chart
            const topEditors = Object.entries(editorMap)
                .sort((a, b) => b[1] - a[1]);

            this.createChart('editorChart', {
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
        },

        createChart(refName, config) {
            const canvas = this.$refs[refName];
            if (!canvas) return;

            if (this.charts[refName]) {
                this.charts[refName].destroy();
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

            this.charts[refName] = new Chart(canvas, {
                ...config,
                options: { ...defaultOptions, ...config.options }
            });
        },

        updateBreakdownTable(usageData) {
            if (!usageData || usageData.length === 0) {
                this.breakdownData = [];
                return;
            }

            const breakdownMap = {};

            usageData.forEach(day => {
                day.breakdown?.forEach(item => {
                    const key = `${item.language || 'unknown'}-${item.editor || 'unknown'}`;
                    if (!breakdownMap[key]) {
                        breakdownMap[key] = {
                            key,
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

            this.breakdownData = Object.values(breakdownMap)
                .map(item => ({
                    ...item,
                    rate: item.suggestions > 0
                        ? ((item.acceptances / item.suggestions) * 100).toFixed(1)
                        : 0
                }))
                .sort((a, b) => b.suggestions - a.suggestions)
                .slice(0, 20);
        }
    }
}).mount('#app');
