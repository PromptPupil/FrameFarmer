import { useStore } from '../../store';

export function WorkflowSelector() {
  const { workflowTemplates, selectedWorkflow, setSelectedWorkflow, clearInputSlots } = useStore();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (id === '') {
      setSelectedWorkflow(null);
    } else {
      const workflow = workflowTemplates.find((w) => w.id === id);
      setSelectedWorkflow(workflow ?? null);
    }
    clearInputSlots();
  };

  return (
    <select
      value={selectedWorkflow?.id ?? ''}
      onChange={handleChange}
      className="select flex-1"
    >
      <option value="">Select workflow...</option>
      {workflowTemplates.map((workflow) => (
        <option key={workflow.id} value={workflow.id}>
          {workflow.name} ({workflow.inputNodes.length} input
          {workflow.inputNodes.length !== 1 ? 's' : ''})
        </option>
      ))}
    </select>
  );
}
