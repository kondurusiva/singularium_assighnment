// API base URL - use relative URL when served from Flask, or absolute for standalone HTML
const API_BASE_URL = window.location.origin;

// Store tasks in memory
let tasks = [];
let taskIdCounter = 0;

// DOM Elements
const taskForm = document.getElementById('taskForm');
const bulkInput = document.getElementById('bulkInput');
const bulkImportBtn = document.getElementById('bulkImportBtn');
const taskList = document.getElementById('taskList');
const taskCount = document.getElementById('taskCount');
const analyzeBtn = document.getElementById('analyzeBtn');
const suggestBtn = document.getElementById('suggestBtn');
const strategySelect = document.getElementById('strategy');
const resultsContainer = document.getElementById('resultsContainer');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Set default due date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dueDate').value = today;
    
    // Event listeners
    taskForm.addEventListener('submit', handleAddTask);
    bulkImportBtn.addEventListener('click', handleBulkImport);
    analyzeBtn.addEventListener('click', handleAnalyze);
    suggestBtn.addEventListener('click', handleSuggest);
    
    updateTaskList();
    updateButtons();
});

// Handle form submission
function handleAddTask(e) {
    e.preventDefault();
    
    const title = document.getElementById('title').value.trim();
    const dueDate = document.getElementById('dueDate').value;
    const estimatedHours = parseFloat(document.getElementById('estimatedHours').value);
    const importance = parseInt(document.getElementById('importance').value);
    const dependenciesInput = document.getElementById('dependencies').value.trim();
    
    // Parse dependencies
    const dependencies = dependenciesInput 
        ? dependenciesInput.split(',').map(d => d.trim()).filter(d => d)
        : [];
    
    const task = {
        id: `task_${taskIdCounter++}`,
        title,
        due_date: dueDate,
        estimated_hours: estimatedHours,
        importance,
        dependencies
    };
    
    tasks.push(task);
    taskForm.reset();
    document.getElementById('dueDate').value = new Date().toISOString().split('T')[0];
    
    updateTaskList();
    updateButtons();
    showSuccess('Task added successfully!');
}

// Handle bulk import
function handleBulkImport() {
    const input = bulkInput.value.trim();
    
    if (!input) {
        showError('Please enter JSON data');
        return;
    }
    
    try {
        const importedTasks = JSON.parse(input);
        
        if (!Array.isArray(importedTasks)) {
            showError('JSON must be an array of tasks');
            return;
        }
        
        // Add IDs to imported tasks if missing
        importedTasks.forEach((task, index) => {
            if (!task.id) {
                task.id = `imported_${taskIdCounter++}`;
            }
        });
        
        tasks = [...tasks, ...importedTasks];
        bulkInput.value = '';
        
        updateTaskList();
        updateButtons();
        showSuccess(`Imported ${importedTasks.length} task(s) successfully!`);
    } catch (error) {
        showError(`Invalid JSON: ${error.message}`);
    }
}

// Update task list display
function updateTaskList() {
    taskList.innerHTML = '';
    taskCount.textContent = tasks.length;
    
    if (tasks.length === 0) {
        taskList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No tasks added yet</p>';
        return;
    }
    
    tasks.forEach((task, index) => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-item';
        
        const depsText = task.dependencies && task.dependencies.length > 0
            ? ` | Depends on: ${task.dependencies.join(', ')}`
            : '';
        
        taskItem.innerHTML = `
            <div class="task-item-info">
                <div class="task-item-title">${escapeHtml(task.title)}</div>
                <div class="task-item-details">
                    Due: ${task.due_date} | ${task.estimated_hours}h | Importance: ${task.importance}/10${depsText}
                </div>
            </div>
            <button class="task-item-remove" onclick="removeTask(${index})">Remove</button>
        `;
        
        taskList.appendChild(taskItem);
    });
}

// Remove task
function removeTask(index) {
    tasks.splice(index, 1);
    updateTaskList();
    updateButtons();
}

// Update button states
function updateButtons() {
    const hasTasks = tasks.length > 0;
    analyzeBtn.disabled = !hasTasks;
    suggestBtn.disabled = !hasTasks;
}

// Handle analyze
async function handleAnalyze() {
    if (tasks.length === 0) {
        showError('Please add at least one task');
        return;
    }
    
    const strategy = strategySelect.value;
    
    showLoading(true);
    hideError();
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/tasks/analyze/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tasks: tasks,
                strategy: strategy
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Analysis failed');
        }
        
        displayResults(data);
    } catch (error) {
        showError(`Error: ${error.message}`);
        console.error('Analysis error:', error);
    } finally {
        showLoading(false);
    }
}

// Handle suggest
async function handleSuggest() {
    if (tasks.length === 0) {
        showError('Please add at least one task');
        return;
    }
    
    const strategy = strategySelect.value;
    
    showLoading(true);
    hideError();
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/tasks/suggest/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tasks: tasks,
                strategy: strategy
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Suggestion failed');
        }
        
        displaySuggestions(data);
    } catch (error) {
        showError(`Error: ${error.message}`);
        console.error('Suggestion error:', error);
    } finally {
        showLoading(false);
    }
}

// Display analysis results
function displayResults(data) {
    resultsContainer.innerHTML = '';
    
    const header = document.createElement('div');
    header.className = 'results-header';
    header.innerHTML = `
        <h3>Analysis Results</h3>
        <p>Strategy: <strong>${formatStrategyName(data.strategy)}</strong> | Total Tasks: ${data.total_tasks}</p>
    `;
    resultsContainer.appendChild(header);
    
    if (data.tasks.length === 0) {
        resultsContainer.innerHTML += '<div class="empty-state"><div class="empty-state-icon">📋</div><p>No tasks to display</p></div>';
        return;
    }
    
    data.tasks.forEach((task, index) => {
        const taskResult = document.createElement('div');
        taskResult.className = `task-result ${task.priority_label.toLowerCase()}-priority`;
        
        const priorityClass = task.priority_label.toLowerCase();
        
        taskResult.innerHTML = `
            <div class="task-result-header">
                <div class="task-result-title">#${index + 1} - ${escapeHtml(task.title)}</div>
                <div style="display: flex; gap: 15px; align-items: center;">
                    <span class="priority-badge ${priorityClass}">${task.priority_label}</span>
                    <span class="score-display">Score: ${task.priority_score.toFixed(3)}</span>
                </div>
            </div>
            <div class="task-result-details">
                <div class="detail-item">
                    <div class="detail-label">Due Date</div>
                    <div class="detail-value">${task.due_date}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Estimated Hours</div>
                    <div class="detail-value">${task.estimated_hours}h</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Importance</div>
                    <div class="detail-value">${task.importance}/10</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Dependencies</div>
                    <div class="detail-value">${task.dependencies && task.dependencies.length > 0 ? task.dependencies.length : 'None'}</div>
                </div>
            </div>
            <div class="explanation">
                <strong>Why this priority?</strong> ${escapeHtml(task.explanation)}
            </div>
        `;
        
        resultsContainer.appendChild(taskResult);
    });
}

// Display suggestions
function displaySuggestions(data) {
    resultsContainer.innerHTML = '';
    
    const header = document.createElement('div');
    header.className = 'results-header';
    header.innerHTML = `
        <h3>Top 3 Task Suggestions</h3>
        <p>Strategy: <strong>${formatStrategyName(data.strategy)}</strong> | Analyzed: ${data.total_analyzed} tasks</p>
    `;
    resultsContainer.appendChild(header);
    
    if (!data.suggestions || data.suggestions.length === 0) {
        resultsContainer.innerHTML += '<div class="empty-state"><div class="empty-state-icon">💡</div><p>No suggestions available</p></div>';
        return;
    }
    
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.className = 'suggestions-container';
    
    data.suggestions.forEach((task, index) => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'suggestion-item';
        
        suggestionItem.innerHTML = `
            <div class="suggestion-number">${index + 1}</div>
            <div class="suggestion-content">
                <div class="suggestion-title">${escapeHtml(task.title)}</div>
                <div style="margin-top: 10px; opacity: 0.9;">
                    <strong>Priority Score:</strong> ${task.priority_score.toFixed(3)} | 
                    <strong>Due:</strong> ${task.due_date} | 
                    <strong>Hours:</strong> ${task.estimated_hours}h | 
                    <strong>Importance:</strong> ${task.importance}/10
                </div>
                <div class="suggestion-explanation">
                    <strong>Why this task?</strong> ${escapeHtml(task.explanation)}
                </div>
            </div>
        `;
        
        suggestionsContainer.appendChild(suggestionItem);
    });
    
    resultsContainer.appendChild(suggestionsContainer);
}

// Utility functions
function showLoading(show) {
    loadingIndicator.style.display = show ? 'block' : 'none';
    resultsContainer.style.opacity = show ? '0.5' : '1';
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    setTimeout(() => {
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

function hideError() {
    errorMessage.style.display = 'none';
}

function showSuccess(message) {
    // Simple success notification (could be enhanced with a toast library)
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => successDiv.remove(), 300);
    }, 3000);
}

function formatStrategyName(strategy) {
    const names = {
        'smart_balance': 'Smart Balance',
        'fastest_wins': 'Fastest Wins',
        'high_impact': 'High Impact',
        'deadline_driven': 'Deadline Driven'
    };
    return names[strategy] || strategy;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
