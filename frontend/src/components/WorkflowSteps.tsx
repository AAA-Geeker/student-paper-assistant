import { CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';

export interface WorkflowNode {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  input_summary?: string;
  output_summary?: string;
}

export interface Workflow {
  type: string;
  title: string;
  description: string;
  nodes: WorkflowNode[];
}

interface WorkflowStepsProps {
  workflow: Workflow | null;
  currentStep?: number; // 当前高亮到第几步
}

export default function WorkflowSteps({ workflow, currentStep }: WorkflowStepsProps) {
  if (!workflow) return null;

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">⚙️</span>
        <h3 className="font-semibold text-foreground/90 text-sm">{workflow.title}</h3>
        <span className="text-xs text-muted-foreground/70 ml-1">{workflow.description}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {workflow.nodes.map((node, idx) => {
          const isCompleted = node.status === 'completed' || (currentStep !== undefined && idx < currentStep);
          const isActive = node.status === 'running' || (currentStep !== undefined && idx === currentStep);
          const isError = node.status === 'error';

          return (
            <div key={node.id} className="flex items-center gap-1">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isError
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : isActive
                    ? 'bg-accent border-indigo-300 text-primary ring-1 ring-ring/30'
                    : isCompleted
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-muted/60 border-border text-muted-foreground'
                }`}
              >
                <span className="text-sm leading-none">{node.icon}</span>
                <span>{node.name}</span>
                {isCompleted && <CheckCircle2 size={12} className="text-emerald-500" />}
                {isActive && <Loader2 size={12} className="animate-spin text-indigo-500" />}
              </div>
              {idx < workflow.nodes.length - 1 && (
                <ChevronRight size={14} className="text-gray-300 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
