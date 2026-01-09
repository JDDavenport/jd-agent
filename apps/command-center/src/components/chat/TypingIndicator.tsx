function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4 animate-fade-in">
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 max-w-[80%]">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-accent">Agent</span>
          <span className="text-text-muted">is typing</span>
        </div>
        <div className="flex space-x-1 mt-2">
          <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

export default TypingIndicator;
