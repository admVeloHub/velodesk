/** RetractableHeaderStack v1.2.0 — splitter no fluxo + recolhimento manual */
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useVelodeskModule } from '../contexts/VelodeskModuleContext';
import { useRetractableHeader } from '../hooks/useRetractableHeader';
import VelohubPrimaryHeader from './VelohubPrimaryHeader';
import VelodeskSecondaryHeader from './VelodeskSecondaryHeader';

export default function RetractableHeaderStack({ onOpenAi }: { onOpenAi?: () => void }) {
  const { isDeskActive } = useVelodeskModule();
  const { isPrimaryVisible, togglePrimary } = useRetractableHeader(true);

  const stackClass = [
    'header-stack',
    isPrimaryVisible ? 'header-stack--primary-visible' : 'header-stack--primary-retracted',
    isDeskActive ? 'header-stack--desk-active' : 'header-stack--desk-inactive',
  ].join(' ');

  return (
    <div className={stackClass}>
      <div className="header-stack__inner">
        <div className="header-stack__primary">
          <VelohubPrimaryHeader />
        </div>

        <div className="header-stack__splitter">
          <span className="header-stack__splitter-line" aria-hidden="true" />
          <button
            type="button"
            className="header-stack__collapse-tab"
            onClick={() => togglePrimary()}
            title={isPrimaryVisible ? 'Recolher barra VeloHub' : 'Expandir barra VeloHub'}
            aria-label={isPrimaryVisible ? 'Recolher barra VeloHub' : 'Expandir barra VeloHub'}
            aria-expanded={isPrimaryVisible}
          >
            {isPrimaryVisible ? (
              <KeyboardArrowUpIcon className="header-stack__collapse-icon" fontSize="small" />
            ) : (
              <KeyboardArrowDownIcon className="header-stack__collapse-icon" fontSize="small" />
            )}
          </button>
        </div>

        <div className="header-stack__secondary" aria-hidden={!isDeskActive}>
          <VelodeskSecondaryHeader onOpenAi={onOpenAi} />
        </div>
      </div>
    </div>
  );
}
