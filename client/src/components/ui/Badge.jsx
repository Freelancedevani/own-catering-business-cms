const colorMap = {
  green:  'badge-green',
  yellow: 'badge-yellow',
  red:    'badge-red',
  blue:   'badge-blue',
  purple: 'badge-purple',
  gray:   'badge-gray',
};

export default function Badge({ label, color = 'gray' }) {
  return (
    <span className={colorMap[color] || 'badge-gray'}>
      {label}
    </span>
  );
}
