import React from 'react';

const proficiencyColors = {
  beginner:     '#e8f4fd',
  intermediate: '#d4edda',
  advanced:     '#fff3cd',
  expert:       '#f8d7da'
};

export default function SkillBadge({ name, proficiency }) {
  const bg = proficiencyColors[proficiency] || '#f0f0f0';
  return (
    <span className="skill-badge" style={{ backgroundColor: bg }} title={proficiency}>
      {name}
      {proficiency && <span className="skill-badge-level">{proficiency[0].toUpperCase()}</span>}
    </span>
  );
}
