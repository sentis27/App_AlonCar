import React from 'react'

export default function LaborInlineCell({
  cellProps,
  className = '',
  title,
  onDoubleClick,
  isEditing,
  editInput,
  onFillHandleMouseDown,
  onFillHandleDoubleClick,
  children
}) {
  return (
    <td
      {...cellProps.domProps}
      onDoubleClick={onDoubleClick}
      className={`${className} ${cellProps.className}`}
      title={title}
    >
      {isEditing ? editInput : children}
      {cellProps.renderHandle && (
        <div
          onMouseDown={onFillHandleMouseDown}
          onDoubleClick={onFillHandleDoubleClick}
          className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md"
        />
      )}
    </td>
  )
}
