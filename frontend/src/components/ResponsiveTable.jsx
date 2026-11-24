import { useId } from 'react';

export function ResponsiveTable({ caption, columns, rows, getRowKey, emptyMessage = 'No records found.' }) {
  const captionId = useId();

  if (!rows || rows.length === 0) {
    return (
      <div className="panel" role="status">
        <p className="muted" style={{ margin: 0 }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div tabIndex={0} role="region" aria-labelledby={captionId} className="table-wrapper">
      <table className="data-table">
        <caption id={captionId}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col">{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={getRowKey ? getRowKey(row, idx) : idx}>
              {columns.map((col, colIdx) => {
                const content = col.render ? col.render(row) : row[col.key];
                if (colIdx === 0) {
                  return (
                    <th key={col.key} scope="row">
                      {content}
                    </th>
                  );
                }
                return (
                  <td key={col.key} data-label={col.header}>
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
