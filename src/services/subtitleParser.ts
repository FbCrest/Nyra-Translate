/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SubtitleItem } from '../types';

export function parseSRT(text: string): SubtitleItem[] {
  const items: SubtitleItem[] = [];
  const blocks = text.trim().split(/\n\s*\n/);

  blocks.forEach((block, index) => {
    const lines = block.split('\n');
    if (lines.length < 3) return;

    const timeLine = lines[1];
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
    
    if (timeMatch) {
      const startTime = timestampToSeconds(timeMatch[1].replace(',', '.'));
      const endTime = timestampToSeconds(timeMatch[2].replace(',', '.'));
      const content = lines.slice(2).join('\n');

      items.push({
        id: `uploaded-${index}`,
        startTime,
        endTime,
        chinese: content, // We assume primary language of the file
      });
    }
  });

  return items;
}

export function parseVTT(text: string): SubtitleItem[] {
  const items: SubtitleItem[] = [];
  const lines = text.trim().split('\n');
  let currentBlock: string[] = [];

  lines.forEach((line, index) => {
    if (line.includes('-->')) {
      const timeMatch = line.match(/(\d{2}:)?\d{2}:\d{2}\.\d{3} --> (\d{2}:)?\d{2}:\d{2}\.\d{3}/);
      if (timeMatch) {
        const times = line.split(' --> ');
        const startTime = timestampToSeconds(times[0]);
        const endTime = timestampToSeconds(times[1].split(' ')[0]);
        
        // Find content
        let contentLines: string[] = [];
        let j = index + 1;
        while (j < lines.length && lines[j].trim() !== '') {
          contentLines.push(lines[j]);
          j++;
        }

        items.push({
          id: `vtt-${index}`,
          startTime,
          endTime,
          chinese: contentLines.join('\n'),
        });
      }
    }
  });

  return items;
}

function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':');
  let seconds = 0;
  if (parts.length === 3) {
    seconds += parseInt(parts[0]) * 3600;
    seconds += parseInt(parts[1]) * 60;
    seconds += parseFloat(parts[2]);
  } else {
    seconds += parseInt(parts[0]) * 60;
    seconds += parseFloat(parts[1]);
  }
  return seconds;
}
