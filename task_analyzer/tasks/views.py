"""
API views for task analysis.
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json

from .serializers import TaskSerializer


@csrf_exempt
@require_http_methods(["POST"])
def analyze_tasks(request):
    """Analyze and sort tasks by priority score."""
    try:
        data = json.loads(request.body)
        
        if not data:
            return JsonResponse({'error': 'No data provided'}, status=400)
        
        # Handle both single task and list of tasks
        if isinstance(data, dict) and 'tasks' in data:
            tasks = data['tasks']
            strategy = data.get('strategy', 'smart_balance')
            weights = data.get('weights', None)
        elif isinstance(data, list):
            tasks = data
            strategy = 'smart_balance'
            weights = None
        else:
            return JsonResponse({
                'error': 'Invalid data format. Expected list of tasks or object with "tasks" array'
            }, status=400)
        
        scored_tasks, error = TaskSerializer.analyze_tasks(tasks, strategy, weights)
        
        if error:
            return JsonResponse({'error': error}, status=400)
        
        return JsonResponse({
            'tasks': scored_tasks,
            'strategy': strategy,
            'total_tasks': len(scored_tasks)
        }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def suggest_tasks(request):
    """Return top 3 task suggestions with explanations."""
    try:
        data = json.loads(request.body)
        
        if not data:
            return JsonResponse({'error': 'No data provided'}, status=400)
        
        if isinstance(data, dict) and 'tasks' in data:
            tasks = data['tasks']
            strategy = data.get('strategy', 'smart_balance')
        elif isinstance(data, list):
            tasks = data
            strategy = 'smart_balance'
        else:
            return JsonResponse({'error': 'Invalid data format'}, status=400)
        
        top_3, error = TaskSerializer.get_suggestions(tasks, strategy, top_n=3)
        
        if error:
            return JsonResponse({'error': error}, status=400)
        
        # Get total analyzed count
        all_tasks, _ = TaskSerializer.analyze_tasks(tasks, strategy)
        total_analyzed = len(all_tasks) if all_tasks else 0
        
        return JsonResponse({
            'suggestions': top_3,
            'strategy': strategy,
            'total_analyzed': total_analyzed
        }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)


@require_http_methods(["GET"])
def health(request):
    return JsonResponse({'status': 'Good'}, status=200)
