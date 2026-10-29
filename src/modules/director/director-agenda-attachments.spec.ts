import { resolveAgendaAttachment } from './director-agenda.service';

describe('Director agenda attachment updates', () => {
  for (const field of ['imageLink', 'fileLink']) {
    describe(field, () => {
      it('preserves an existing value when undefined', () => {
        expect(resolveAgendaAttachment(undefined, 'https://old.example/file')).toBe('https://old.example/file');
      });
      it('removes the reference with an empty string', () => {
        expect(resolveAgendaAttachment('', 'https://old.example/file')).toBe('');
      });
      it('never yields null (NOT NULL column)', () => {
        expect(resolveAgendaAttachment(null, 'https://old.example/file')).toBe('');
      });
      it('replaces the reference with a non-empty URL', () => {
        expect(resolveAgendaAttachment(' https://new.example/file ', 'old')).toBe('https://new.example/file');
      });
    });
  }
});
