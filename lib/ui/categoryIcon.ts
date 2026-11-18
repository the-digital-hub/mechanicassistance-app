import {
    AlertTriangle,
    Battery,
    CarFront,
    CircleDot,
    ClipboardCheck,
    Cog,
    Disc,
    Droplets,
    Fuel,
    Gauge,
    HelpCircle,
    KeyRound,
    SlidersHorizontal,
    Snowflake,
    Thermometer,
    Wrench,
    Zap,
    type LucideIcon,
} from 'lucide-react-native';

/**
 * The icon of a category of issues or services. The catalog's own `icon` key is free-form (set in the
 * admin) and some categories carry none, so the name decides when the key is unknown: first match wins,
 * English and Spanish, and a wrench is the last resort.
 */
const BY_KEY: Record<string, LucideIcon> = {
    bolt: Zap,
    battery: Battery,
    electrical: Zap,
    tire: CircleDot,
    wheel: CircleDot,
    warning: AlertTriangle,
    wrench: Wrench,
    tool: Wrench,
    other: HelpCircle,
    help: HelpCircle,
};

const BY_NAME: [RegExp, LucideIcon][] = [
    [/fuel|gas\b|gasoline|diesel|combustib|nafta/, Fuel],
    [/tire|wheel|rim\b|neum|llanta|rueda/, CircleDot],
    [/brake|freno/, Disc],
    [/hvac|climate|a\/c|\bac\b|air.?cond|heater|clima|aire/, Snowflake],
    [/engine|motor|ignition|encendido|belt|correa/, Cog],
    [/temperature|cooling|coolant|overheat|radiator|temperatura|refriger/, Thermometer],
    [/transmission|drivetrain|clutch|gearbox|transmis|embrague|caja/, Gauge],
    [/suspension|steering|susp|direcc/, SlidersHorizontal],
    [/electric|electr|battery|bater|start|charging|arranque|carga/, Zap],
    [/warning|light|dash|luz|luces|tablero/, AlertTriangle],
    [/access|stuck|lock|key|door|trunk|llave|cerr|puerta|atasc|baul|maletero/, KeyRound],
    [/body|dent|collision|paint|glass|windshield|carroc|golpe|choque|vidrio|parabrisas/, CarFront],
    [/oil|fluid|aceite|fluido|lubric/, Droplets],
    [/inspect|diagnos|scan|inspecc|diagn/, ClipboardCheck],
];

export function categoryIcon({ icon, name, code }: { icon?: string | null; name?: string | null; code?: string | null }): LucideIcon {
    const byKey = icon ? BY_KEY[icon.toLowerCase()] : undefined;
    if (byKey) return byKey;
    const text = `${code ?? ''} ${name ?? ''}`.toLowerCase().replace(/_/g, ' ');
    return BY_NAME.find(([re]) => re.test(text))?.[1] ?? Wrench;
}
