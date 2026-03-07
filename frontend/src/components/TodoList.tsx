"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { TodoItem, UserTodos } from "@/lib/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * Compensates for ancestor CSS transforms that break position:fixed
 * in DragOverlay's portal. Measures the actual offset by temporarily
 * inserting a probe element and comparing its fixed position.
 */
function useTransformCompensation(containerRef: React.RefObject<HTMLDivElement | null>): Modifier[] {
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;pointer-events:none;visibility:hidden";
    el.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    el.removeChild(probe);

    offsetRef.current = { x: rect.left, y: rect.top };
  });

  return useMemo(() => {
    const modifier: Modifier = ({ transform }) => {
      const { x: ox, y: oy } = offsetRef.current;
      if (ox === 0 && oy === 0) return transform;
      return { ...transform, x: transform.x - ox, y: transform.y - oy };
    };
    return [modifier];
  }, []);
}

interface TodoListProps {
  userTodos: UserTodos | null;
  onAddTodo: (text: string) => void;
  onUpdateTodo: (todoId: string, updates: { text?: string; completed?: boolean }) => void;
  onDeleteTodo: (todoId: string) => void;
  onReorderTodos?: (todoIds: string[]) => void;
  onSetActiveTodo: (todoId: string | null) => void;
  onSetVisibility: (isPublic: boolean) => void;
}

export function TodoList({
  userTodos,
  onAddTodo,
  onUpdateTodo,
  onDeleteTodo,
  onReorderTodos,
  onSetActiveTodo,
  onSetVisibility,
}: TodoListProps) {
  const [newTodoText, setNewTodoText] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const todos = userTodos?.todos || [];
  const activeTodoId = userTodos?.activeTodoId || null;
  const isPublic = userTodos?.isPublic ?? true;

  const todoIds = useMemo(() => todos.map(t => t.id), [todos]);
  const activeDragTodo = useMemo(
    () => (activeId ? todos.find(t => t.id === activeId) : null),
    [activeId, todos]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    })
  );

  const overlayModifiers = useTransformCompensation(wrapperRef);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodoText.trim()) {
      onAddTodo(newTodoText.trim());
      setNewTodoText("");
    }
  };

  const handleToggleComplete = (todo: TodoItem) => {
    onUpdateTodo(todo.id, { completed: !todo.completed });
  };

  const handleSetActive = (todoId: string) => {
    if (activeTodoId === todoId) {
      onSetActiveTodo(null);
    } else {
      onSetActiveTodo(todoId);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderTodos) return;

    const oldIndex = todos.findIndex(t => t.id === active.id);
    const newIndex = todos.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(todos, oldIndex, newIndex);
    onReorderTodos(reordered.map(t => t.id));
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const completedCount = todos.filter(t => t.completed).length;

  return (
    <div ref={wrapperRef} className="w-72 flex flex-col relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors group"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <span className="font-medium text-sm">My Tasks</span>
          <span className="text-white/40 text-xs">
            ({completedCount}/{todos.length})
          </span>
        </button>

        {/* Visibility toggle with tooltip */}
        <div className="relative group/visibility">
          <button
            onClick={() => onSetVisibility(!isPublic)}
            className={`
              p-1.5 rounded-lg transition-all duration-200
              ${isPublic
                ? "text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/10"
                : "text-white/40 hover:text-white/60 hover:bg-white/5"
              }
            `}
          >
            {isPublic ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            )}
          </button>
          {/* Tooltip */}
          <div className="
            absolute right-0 top-full mt-2 px-2.5 py-1.5 
            bg-black/90 border border-white/10 rounded-lg
            text-xs text-white/80 whitespace-nowrap
            opacity-0 invisible group-hover/visibility:opacity-100 group-hover/visibility:visible
            transition-all duration-200 z-50
          ">
            {isPublic ? "Visible to others in room" : "Hidden from others"}
          </div>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Add todo form */}
          <form onSubmit={handleSubmit} className="mb-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                placeholder="Add a task..."
                maxLength={200}
                className="
                  flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                  text-sm text-white placeholder-white/30
                  focus:outline-none focus:border-white/20 focus:bg-white/10
                  transition-all duration-200
                "
              />
              <button
                type="submit"
                disabled={!newTodoText.trim()}
                className="
                  px-3 py-2 bg-white/10 border border-white/10 rounded-lg
                  text-white/70 hover:text-white hover:bg-white/15
                  disabled:opacity-30 disabled:cursor-not-allowed
                  transition-all duration-200
                "
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </form>

          {/* Todo list */}
          <div
            ref={listRef}
            className="
              flex-1 overflow-y-auto max-h-64 pr-1
              scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent
            "
          >
            {todos.length === 0 ? (
              <div className="text-center py-6 text-white/30 text-sm">
                No tasks yet. Add one above!
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext items={todoIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1.5">
                    {todos.map((todo) => (
                      <SortableTodoItem
                        key={todo.id}
                        todo={todo}
                        isActive={todo.id === activeTodoId}
                        isDragActive={todo.id === activeId}
                        onToggleComplete={() => handleToggleComplete(todo)}
                        onSetActive={() => handleSetActive(todo.id)}
                        onDelete={() => onDeleteTodo(todo.id)}
                        onUpdateText={(text) => onUpdateTodo(todo.id, { text })}
                        canReorder={!!onReorderTodos}
                      />
                    ))}
                  </div>
                </SortableContext>

                <DragOverlay
                  dropAnimation={null}
                  modifiers={overlayModifiers}
                >
                  {activeDragTodo ? (
                    <TodoItemContent
                      todo={activeDragTodo}
                      isActive={activeDragTodo.id === activeTodoId}
                      isOverlay
                      onToggleComplete={() => {}}
                      onSetActive={() => {}}
                      onDelete={() => {}}
                      onUpdateText={() => {}}
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>

          {/* Completed count */}
          {completedCount > 0 && (
            <div className="mt-2 pt-2 border-t border-white/5 text-xs text-white/30 text-center">
              {completedCount} completed
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface SortableTodoItemProps {
  todo: TodoItem;
  isActive: boolean;
  isDragActive: boolean;
  onToggleComplete: () => void;
  onSetActive: () => void;
  onDelete: () => void;
  onUpdateText: (text: string) => void;
  canReorder: boolean;
}

function SortableTodoItem({
  todo,
  isActive,
  isDragActive,
  onToggleComplete,
  onSetActive,
  onDelete,
  onUpdateText,
  canReorder,
}: SortableTodoItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isSorting,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isSorting ? transition : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragActive ? "opacity-0" : ""}
    >
      <TodoItemContent
        todo={todo}
        isActive={isActive}
        onToggleComplete={onToggleComplete}
        onSetActive={onSetActive}
        onDelete={onDelete}
        onUpdateText={onUpdateText}
        dragHandleProps={canReorder ? { ...attributes, ...listeners } : undefined}
      />
    </div>
  );
}

interface TodoItemContentProps {
  todo: TodoItem;
  isActive: boolean;
  isOverlay?: boolean;
  onToggleComplete: () => void;
  onSetActive: () => void;
  onDelete: () => void;
  onUpdateText: (text: string) => void;
  dragHandleProps?: Record<string, unknown>;
}

function TodoItemContent({
  todo,
  isActive,
  isOverlay,
  onToggleComplete,
  onSetActive,
  onDelete,
  onUpdateText,
  dragHandleProps,
}: TodoItemContentProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setEditText(todo.text);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== todo.text) {
      onUpdateText(trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(todo.text);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  return (
    <div
      className={`
        group flex items-start gap-2 p-2 rounded-lg transition-colors duration-200
        ${isOverlay
          ? "bg-white/15 border border-rose-500/40 shadow-lg shadow-black/30 ring-1 ring-rose-500/20 scale-[1.02]"
          : isActive
            ? "bg-rose-500/15 border border-rose-500/30"
            : "bg-white/5 border border-transparent hover:bg-white/8 hover:border-white/10"
        }
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag handle */}
      {dragHandleProps && (
        <div
          className={`
            mt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing
            transition-opacity duration-150 touch-none
            ${isHovered && !isEditing ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-40"}
          `}
          title="Drag to reorder"
          {...dragHandleProps}
        >
          <svg className="w-3.5 h-3.5 text-white/50" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </div>
      )}

      {/* Checkbox */}
      <button
        onClick={onToggleComplete}
        className={`
          mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center
          transition-all duration-200
          ${todo.completed
            ? "bg-emerald-500/30 border-emerald-500/50 text-emerald-400"
            : "border-white/30 hover:border-white/50"
          }
        `}
      >
        {todo.completed && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Todo text & actions */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={editInputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            maxLength={200}
            className="
              w-full px-2 py-0.5 bg-white/10 border border-white/20 rounded
              text-sm text-white focus:outline-none focus:border-white/40
            "
          />
        ) : (
          <p
            onDoubleClick={handleStartEdit}
            className={`
              text-sm leading-snug break-words cursor-text
              ${todo.completed
                ? "line-through text-white/30"
                : "text-white/80"
              }
            `}
          >
            {todo.text}
          </p>
        )}
      </div>

      {/* Action buttons */}
      {!isOverlay && (
        <div className={`
          flex items-center gap-0.5 flex-shrink-0 transition-opacity duration-150
          ${isHovered && !isEditing ? "opacity-100" : "opacity-0"}
        `}>
          {/* Edit button */}
          <button
            onClick={handleStartEdit}
            className="p-1 rounded text-white/40 hover:text-white/70 transition-colors duration-150"
            title="Edit task"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </button>

          {/* Focus/Active button */}
          {!todo.completed && (
            <button
              onClick={onSetActive}
              className={`
                p-1 rounded transition-colors duration-150
                ${isActive
                  ? "text-rose-400 hover:text-rose-300"
                  : "text-white/40 hover:text-white/70"
                }
              `}
              title={isActive ? "Unfocus this task" : "Focus on this task"}
            >
              <svg className="w-3.5 h-3.5" fill={isActive ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
              </svg>
            </button>
          )}

          {/* Delete button */}
          <button
            onClick={onDelete}
            className="p-1 rounded text-white/40 hover:text-red-400 transition-colors duration-150"
            title="Delete task"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
