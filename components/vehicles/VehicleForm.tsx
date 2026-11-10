import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { CatalogSelect } from '@/components/vehicles/CatalogSelect';
import { TireSizeSelect } from '@/components/vehicles/TireSizeSelect';
import { VehicleColorSelect } from '@/components/vehicles/VehicleColorSelect';
import { VehicleFormSection } from '@/components/vehicles/VehicleFormSection';
import { AV, AVCheckbox, AVField, AVRow, AVTextInput } from '@/components/vehicles/vehicleFormDesign';
import { VIN_LENGTH, VinCard } from '@/components/vehicles/VinCard';
import type { Vehicle, VehicleDecodedFields, VehicleStatus } from '@/lib/dao/interfaces';
import { decodeVin, fetchMakes, fetchModelsByMake } from '@/lib/vehicle';
import { TireSize, formatTireSize, parseTireSize } from '@/lib/vehicleTires';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    KeyboardTypeOptions,
    Platform,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * What the form hands back: the fields of POST /api/vehicles (and of each
 * entry of `vehicles` in POST /api/users), without `userId`. Only DTO fields —
 * the backend rejects anything else. A cleared optional field is sent as null
 * so an edit can empty it.
 */
export type VehicleFormPayload = Omit<Vehicle, 'id' | 'userId' | 'colorCatalog'> &
    Omit<VehicleDecodedFields, keyof Vehicle>;

interface VehicleFormProps {
    /** The vehicle being edited; omit to add a new one. */
    initialValue?: Partial<Vehicle>;
    submitLabel: string;
    submitting?: boolean;
    onSubmit: (payload: VehicleFormPayload) => void | Promise<void>;
    /** Scrolls with the form, above the VIN card (badge, title, subtitle). */
    header?: ReactNode;
    /** Pads the fixed footer for the home indicator; off when a tab bar sits below. */
    safeBottom?: boolean;
}

type SectionKey = 'info' | 'technical' | 'tires' | 'insurance' | 'additional';

/** GPS tracker select. The backend keeps only a yes/no (`hasGps`). */
type GpsOption = '' | 'none' | 'builtin' | 'aftermarket';

interface FormValues {
    vin: string;
    make: string;
    model: string;
    year: string;
    trim: string;
    color: string;
    colorId: string | null;
    plate: string;
    plateState: string;
    status: VehicleStatus | '';
    gps: GpsOption;
    vehicleTypeId: string;
    engineTypeId: string;
    fuelTypeId: string;
    bodyClass: string;
    transmissionStyle: string;
    driveType: string;
    doors: string;
    displacementL: string;
    engineHp: string;
    engineCylinders: string;
    frontTires: TireSize;
    rearTires: TireSize;
    spareTireTypeId: string;
    insuranceCompany: string;
    insuranceCompanyCode: string;
    insurancePolicyNumber: string;
    mileage: string;
    details: string;
}

type FieldKey = keyof FormValues;
type TextFieldKey =
    | 'year'
    | 'trim'
    | 'plate'
    | 'plateState'
    | 'bodyClass'
    | 'transmissionStyle'
    | 'driveType'
    | 'doors'
    | 'displacementL'
    | 'engineHp'
    | 'engineCylinders'
    | 'insuranceCompany'
    | 'insuranceCompanyCode'
    | 'insurancePolicyNumber'
    | 'mileage'
    | 'details';
type ErrorCode = 'vinRequired' | 'vinLength' | 'plateState' | 'naic' | 'number' | 'tireIncomplete';

/** Decoded VIN data that has no field of its own; saved as it came. */
type HiddenDecoded = Pick<
    VehicleDecodedFields,
    'nhtsaVehicleType' | 'manufacturer' | 'fuelTypePrimary' | 'electrificationLevel' | 'plantCountry' | 'vinDecoded'
>;

/** Where each validated field lives, to open its section when it fails. */
const FIELD_SECTION: Partial<Record<FieldKey, SectionKey>> = {
    year: 'info',
    plateState: 'info',
    doors: 'technical',
    displacementL: 'technical',
    engineHp: 'technical',
    engineCylinders: 'technical',
    frontTires: 'tires',
    rearTires: 'tires',
    insuranceCompanyCode: 'insurance',
    mileage: 'additional',
};

/** Same limits as CreateVehicleDto, so a bad value is caught before the request. */
const NUMBER_RULES: Partial<Record<TextFieldKey, { min: number; max: number; integer: boolean }>> = {
    year: { min: 1900, max: 2100, integer: true },
    doors: { min: 0, max: 10, integer: true },
    displacementL: { min: 0, max: 30, integer: false },
    engineHp: { min: 0, max: 5000, integer: true },
    engineCylinders: { min: 0, max: 24, integer: true },
    mileage: { min: 0, max: 10_000_000, integer: true },
};

/** Operational status choices of the design, mapped to the backend's values. */
const STATUS_OPTIONS: { value: VehicleStatus; key: string }[] = [
    { value: 'active', key: 'statusActive' },
    { value: 'out_of_service', key: 'statusInactive' },
    { value: 'maintenance', key: 'statusRepair' },
];

const GPS_OPTIONS: { value: Exclude<GpsOption, ''>; key: string }[] = [
    { value: 'none', key: 'gpsNone' },
    { value: 'builtin', key: 'gpsBuiltIn' },
    { value: 'aftermarket', key: 'gpsAftermarket' },
];

const str = (v?: string | number | null) => (v === undefined || v === null ? '' : String(v));
const text = (s: string) => s.trim() || null;
const num = (s: string) => (s.trim() === '' ? null : Number(s.trim().replace(',', '.')));

const toValues = (v?: Partial<Vehicle>): FormValues => ({
    vin: str(v?.vin),
    make: v?.make && v.make !== 'Select' ? v.make : '',
    model: v?.model && v.model !== 'Select' ? v.model : '',
    year: str(v?.year),
    trim: str(v?.trim),
    color: str(v?.color),
    colorId: v?.colorId ?? null,
    plate: str(v?.plate),
    plateState: str(v?.plateState),
    status: v?.status ?? 'active',
    gps: v?.hasGps === undefined ? '' : v.hasGps ? 'builtin' : 'none',
    vehicleTypeId: str(v?.vehicleTypeId),
    engineTypeId: str(v?.engineTypeId),
    fuelTypeId: str(v?.fuelTypeId),
    bodyClass: str(v?.bodyClass),
    transmissionStyle: str(v?.transmissionStyle),
    driveType: str(v?.driveType),
    doors: str(v?.doors),
    displacementL: str(v?.displacementL),
    engineHp: str(v?.engineHp),
    engineCylinders: str(v?.engineCylinders),
    frontTires: parseTireSize(v?.frontTires),
    rearTires: parseTireSize(v?.rearTires),
    spareTireTypeId: str(v?.spareTireTypeId),
    insuranceCompany: str(v?.insuranceCompany),
    insuranceCompanyCode: str(v?.insuranceCompanyCode),
    insurancePolicyNumber: str(v?.insurancePolicyNumber),
    mileage: str(v?.mileage),
    details: str(v?.details),
});

const validate = (v: FormValues): Partial<Record<FieldKey, ErrorCode>> => {
    const errors: Partial<Record<FieldKey, ErrorCode>> = {};
    const vin = v.vin.trim();
    if (!vin) errors.vin = 'vinRequired';
    else if (vin.length !== VIN_LENGTH) errors.vin = 'vinLength';
    if (v.plateState.trim() && !/^[A-Za-z]{2}$/.test(v.plateState.trim())) errors.plateState = 'plateState';
    if (v.insuranceCompanyCode.trim() && !/^\d{5}$/.test(v.insuranceCompanyCode.trim())) {
        errors.insuranceCompanyCode = 'naic';
    }
    (Object.keys(NUMBER_RULES) as TextFieldKey[]).forEach(key => {
        const rule = NUMBER_RULES[key]!;
        const n = num(v[key] ?? '');
        if (n === null) return;
        if (Number.isNaN(n) || n < rule.min || n > rule.max || (rule.integer && !Number.isInteger(n))) {
            errors[key] = 'number';
        }
    });
    (['frontTires', 'rearTires'] as const).forEach(key => {
        const { width, profile, rim } = v[key];
        const parts = [width, profile, rim].filter(Boolean).length;
        if (parts > 0 && parts < 3) errors[key] = 'tireIncomplete';
    });
    return errors;
};

const toPayload = (v: FormValues, hidden: HiddenDecoded | null): VehicleFormPayload => ({
    vin: v.vin.trim(),
    make: v.make,
    model: v.model,
    year: num(v.year),
    trim: text(v.trim),
    color: v.color,
    colorId: v.colorId,
    plate: v.plate.trim(),
    // Fields with a backend default are left out when empty, so the default
    // applies; the other optional ones are cleared with null.
    plateState: v.plateState.trim().toUpperCase() || undefined,
    status: v.status || undefined,
    hasGps: v.gps ? v.gps !== 'none' : undefined,
    vehicleTypeId: v.vehicleTypeId || undefined,
    engineTypeId: v.engineTypeId || undefined,
    spareTireTypeId: v.spareTireTypeId || undefined,
    fuelTypeId: v.fuelTypeId || null,
    bodyClass: text(v.bodyClass),
    transmissionStyle: text(v.transmissionStyle),
    driveType: text(v.driveType),
    doors: num(v.doors),
    displacementL: num(v.displacementL),
    engineHp: num(v.engineHp),
    engineCylinders: num(v.engineCylinders),
    frontTires: formatTireSize(v.frontTires),
    rearTires: formatTireSize(v.rearTires),
    insuranceCompany: text(v.insuranceCompany),
    insuranceCompanyCode: text(v.insuranceCompanyCode),
    insurancePolicyNumber: text(v.insurancePolicyNumber),
    mileage: num(v.mileage),
    details: v.details,
    ...hidden,
});

/**
 * The vehicle owner's vehicle form, shared by the Vehicles tab and the vehicle
 * step of sign-up. Laid out as the Claude Design "Add Vehicle" mock: VIN card
 * first (the one required field), collapsible sections, and a fixed Save bar.
 */
export function VehicleForm({ initialValue, submitLabel, submitting, onSubmit, header, safeBottom }: VehicleFormProps) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [values, setValues] = useState<FormValues>(() => toValues(initialValue));
    const [hidden, setHidden] = useState<HiddenDecoded | null>(null);
    const [decoded, setDecoded] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<FieldKey, ErrorCode>>>({});
    const [open, setOpen] = useState<Record<SectionKey, boolean>>({
        info: true,
        technical: false,
        tires: false,
        insurance: false,
        additional: false,
    });
    // Rear mirrors front until unticked; starts unticked only when the saved sizes differ.
    const [rearSame, setRearSame] = useState(
        () => formatTireSize(values.frontTires) === formatTireSize(values.rearTires),
    );
    const [isVinSearching, setIsVinSearching] = useState(false);
    const [makes, setMakes] = useState<string[]>([]);
    const [models, setModels] = useState<string[]>([]);
    const [isLoadingMakes, setIsLoadingMakes] = useState(true);
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    useEffect(() => {
        let mounted = true;
        fetchMakes().then(data => {
            if (!mounted) return;
            setMakes(data);
            setIsLoadingMakes(false);
        });
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!values.make) {
            setModels([]);
            return;
        }
        let mounted = true;
        setIsLoadingModels(true);
        fetchModelsByMake(values.make).then(data => {
            if (!mounted) return;
            setModels(data);
            setIsLoadingModels(false);
        });
        return () => {
            mounted = false;
        };
    }, [values.make]);

    const makeOptions = useMemo(() => makes.map(m => ({ value: m, label: m })), [makes]);
    const modelOptions = useMemo(() => models.map(m => ({ value: m, label: m })), [models]);
    const statusOptions = useMemo(
        () => STATUS_OPTIONS.map(o => ({ value: o.value, label: t(`vehicles.form.design.${o.key}`) })),
        [t],
    );
    const gpsOptions = useMemo(
        () => GPS_OPTIONS.map(o => ({ value: o.value, label: t(`vehicles.form.design.${o.key}`) })),
        [t],
    );

    const set = <K extends FieldKey>(key: K, value: FormValues[K]) => {
        setValues(prev => ({ ...prev, [key]: value }));
        setErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev));
    };

    const toggle = (key: SectionKey) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

    const sectionHasError = (key: SectionKey) =>
        (Object.keys(errors) as FieldKey[]).some(f => errors[f] && FIELD_SECTION[f] === key);

    const errorText = (key: FieldKey) => (errors[key] ? t(`vehicles.form.errors.${errors[key]}`) : null);

    const setFrontTires = (v: TireSize) => {
        setValues(prev => ({ ...prev, frontTires: v, rearTires: rearSame ? { ...v } : prev.rearTires }));
        setErrors(prev => ({ ...prev, frontTires: undefined, rearTires: rearSame ? undefined : prev.rearTires }));
    };

    const toggleRearSame = () => {
        if (!rearSame) {
            setValues(prev => ({ ...prev, rearTires: { ...prev.frontTires } }));
            setErrors(prev => ({ ...prev, rearTires: undefined }));
        }
        setRearSame(!rearSame);
    };

    const handleVinLookup = async () => {
        const vin = values.vin.trim();
        if (vin.length !== VIN_LENGTH) {
            Alert.alert(t('vehicles.invalidVinTitle'), t('vehicles.invalidVinMessage'));
            return;
        }

        setIsVinSearching(true);
        try {
            await decodeVin(
                vin,
                (make, decodedModel, d) => {
                    const model = decodedModel === 'Select' ? '' : decodedModel;
                    setValues(prev => ({
                        ...prev,
                        make,
                        model,
                        year: str(d.year) || prev.year,
                        trim: d.trim ?? prev.trim,
                        bodyClass: d.bodyClass ?? prev.bodyClass,
                        transmissionStyle: d.transmissionStyle ?? prev.transmissionStyle,
                        driveType: d.driveType ?? prev.driveType,
                        doors: str(d.doors) || prev.doors,
                        displacementL: str(d.displacementL) || prev.displacementL,
                        engineHp: str(d.engineHp) || prev.engineHp,
                        engineCylinders: str(d.engineCylinders) || prev.engineCylinders,
                        vehicleTypeId: d.vehicleTypeId ?? prev.vehicleTypeId,
                        engineTypeId: d.engineTypeId ?? prev.engineTypeId,
                    }));
                    setHidden({
                        nhtsaVehicleType: d.nhtsaVehicleType,
                        manufacturer: d.manufacturer,
                        fuelTypePrimary: d.fuelTypePrimary,
                        electrificationLevel: d.electrificationLevel,
                        plantCountry: d.plantCountry,
                        vinDecoded: d.vinDecoded,
                    });
                    setDecoded(true);
                    setErrors(prev => ({ ...prev, vin: undefined, year: undefined }));
                },
                code => {
                    Alert.alert(t('vehicles.vinNotFoundTitle'), t(`vehicles.form.vinError.${code}`));
                },
            );
        } finally {
            setIsVinSearching(false);
        }
    };

    const handleSubmit = () => {
        const found = validate(values);
        setErrors(found);
        const failed = (Object.keys(found) as FieldKey[]).filter(f => found[f]);
        if (failed.length > 0) {
            // Open every section holding a field that needs fixing.
            setOpen(prev => {
                const next = { ...prev };
                failed.forEach(f => {
                    const section = FIELD_SECTION[f];
                    if (section) next[section] = true;
                });
                return next;
            });
            Alert.alert(t('vehicles.form.fixErrorsTitle'), t('vehicles.form.fixErrorsMessage'));
            return;
        }
        onSubmit(toPayload(values, hidden));
    };

    const textField = (
        key: TextFieldKey,
        label: string,
        options: {
            placeholder?: string;
            keyboardType?: KeyboardTypeOptions;
            maxLength?: number;
            upper?: boolean;
            mono?: boolean;
            multiline?: boolean;
        } = {},
    ) => (
        <AVField label={label} error={errorText(key)}>
            <AVTextInput
                value={values[key]}
                onChangeText={v => set(key, options.upper ? v.toUpperCase() : v)}
                placeholder={options.placeholder}
                keyboardType={options.keyboardType}
                maxLength={options.maxLength}
                multiline={options.multiline}
                numberOfLines={options.multiline ? 3 : undefined}
                mono={options.mono}
                hasError={Boolean(errors[key])}
                // Brand names, codes and plates are not words: autocorrect only mangles them.
                autoCorrect={options.multiline === true}
                autoCapitalize={options.upper ? 'characters' : 'sentences'}
            />
        </AVField>
    );

    const select = (label: string) => ({
        placeholder: t('vehicles.form.select'),
        title: label,
        searchPlaceholder: t('vehicles.form.search'),
        emptyText: t('vehicles.form.noResults'),
        doneText: t('vehicles.done'),
        variant: 'vehicle' as const,
    });

    const vinReady = values.vin.trim().length === VIN_LENGTH;
    const canSave = vinReady && !submitting;
    const optional = t('vehicles.form.design.optional');
    const statusLabel = values.status ? statusOptions.find(o => o.value === values.status)?.label ?? values.status : undefined;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: AV.page }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, gap: 14 }}
                keyboardShouldPersistTaps="handled"
            >
                {header}

                <VinCard
                    value={values.vin}
                    onChange={v => {
                        setHidden(null);
                        setDecoded(false);
                        set('vin', v);
                    }}
                    onDecode={handleVinLookup}
                    decoding={isVinSearching}
                    decoded={decoded}
                    error={errorText('vin')}
                />

                <VehicleFormSection
                    icon="car"
                    title={t('vehicles.form.sections.info')}
                    subtitle={t('vehicles.form.design.infoSubtitle')}
                    done={decoded && !open.info}
                    open={open.info}
                    onToggle={() => toggle('info')}
                    hasError={sectionHasError('info')}
                >
                    <AVRow>
                        <AVField label={t('vehicles.form.design.make')}>
                            <SearchableSelect
                                {...select(t('vehicles.selectMake'))}
                                options={makeOptions}
                                value={values.make || null}
                                onChange={o => setValues(prev => ({ ...prev, make: o.value, model: '' }))}
                                searchPlaceholder={t('setup.vehicleInfo.searchMake')}
                                loading={isLoadingMakes}
                                fallbackLabel={values.make || undefined}
                            />
                        </AVField>
                        <View style={{ opacity: values.make ? 1 : 0.5 }} pointerEvents={values.make ? 'auto' : 'none'}>
                            <AVField label={t('vehicles.form.design.model')}>
                                <SearchableSelect
                                    {...select(t('vehicles.selectModel'))}
                                    options={modelOptions}
                                    value={values.model || null}
                                    onChange={o => set('model', o.value)}
                                    searchPlaceholder={t('setup.vehicleInfo.searchModel')}
                                    loading={isLoadingModels}
                                    fallbackLabel={values.model || undefined}
                                />
                            </AVField>
                        </View>
                    </AVRow>
                    <AVRow>
                        {textField('year', t('vehicles.form.year'), {
                            placeholder: t('vehicles.form.design.yearPlaceholder'),
                            keyboardType: 'number-pad',
                            maxLength: 4,
                        })}
                        {textField('trim', t('vehicles.form.trim'), { placeholder: 'LE, XLE…' })}
                    </AVRow>
                    <AVField label={t('vehicles.color')}>
                        <VehicleColorSelect
                            colorId={values.colorId}
                            legacyColor={values.color}
                            onChange={c => setValues(prev => ({ ...prev, colorId: c.id, color: c.label }))}
                        />
                    </AVField>
                    <AVRow>
                        {textField('plate', t('vehicles.form.design.plate'), { placeholder: 'ABC-1234', upper: true })}
                        {textField('plateState', t('vehicles.form.design.plateState'), {
                            placeholder: 'FL',
                            maxLength: 2,
                            upper: true,
                        })}
                    </AVRow>
                    <AVRow>
                        <AVField label={t('vehicles.form.design.status')}>
                            <SearchableSelect
                                {...select(t('vehicles.form.design.status'))}
                                options={statusOptions}
                                value={values.status || null}
                                onChange={o => set('status', o.value)}
                                fallbackLabel={statusLabel}
                            />
                        </AVField>
                        <AVField label={t('vehicles.form.design.gps')}>
                            <SearchableSelect
                                {...select(t('vehicles.form.design.gps'))}
                                options={gpsOptions}
                                value={values.gps || null}
                                onChange={o => set('gps', o.value)}
                            />
                        </AVField>
                    </AVRow>
                </VehicleFormSection>

                <VehicleFormSection
                    icon="gear"
                    title={t('vehicles.form.sections.technical')}
                    subtitle={t(decoded ? 'vehicles.form.design.technicalFromVin' : 'vehicles.form.design.technicalSubtitle')}
                    open={open.technical}
                    onToggle={() => toggle('technical')}
                    hasError={sectionHasError('technical')}
                >
                    <AVRow>
                        <AVField label={t('vehicles.form.vehicleType')}>
                            <CatalogSelect
                                kind="vehicle-types"
                                value={values.vehicleTypeId || null}
                                onChange={id => set('vehicleTypeId', id)}
                                title={t('vehicles.form.vehicleType')}
                            />
                        </AVField>
                        <AVField label={t('vehicles.form.engineType')}>
                            <CatalogSelect
                                kind="engine-types"
                                value={values.engineTypeId || null}
                                onChange={id => set('engineTypeId', id)}
                                title={t('vehicles.form.engineType')}
                            />
                        </AVField>
                    </AVRow>
                    <AVRow>
                        <AVField label={t('vehicles.form.fuelType')}>
                            <CatalogSelect
                                kind="fuel-types"
                                value={values.fuelTypeId || null}
                                onChange={id => set('fuelTypeId', id)}
                                title={t('vehicles.form.fuelType')}
                            />
                        </AVField>
                        {textField('bodyClass', t('vehicles.form.bodyClass'), {
                            placeholder: t('vehicles.form.bodyClassPlaceholder'),
                        })}
                    </AVRow>
                    <AVRow>
                        {textField('transmissionStyle', t('vehicles.form.transmission'), {
                            placeholder: t('vehicles.form.transmissionPlaceholder'),
                        })}
                        {textField('driveType', t('vehicles.form.driveType'), { placeholder: 'FWD, AWD…' })}
                    </AVRow>
                    <AVRow gap={8}>
                        {textField('doors', t('vehicles.form.doors'), { placeholder: '4', keyboardType: 'number-pad', maxLength: 2 })}
                        {textField('displacementL', t('vehicles.form.design.displacement'), {
                            placeholder: '2.5',
                            keyboardType: 'decimal-pad',
                            maxLength: 5,
                        })}
                        {textField('engineHp', t('vehicles.form.horsepower'), {
                            placeholder: '203',
                            keyboardType: 'number-pad',
                            maxLength: 4,
                        })}
                        {textField('engineCylinders', t('vehicles.form.cylinders'), {
                            placeholder: '4',
                            keyboardType: 'number-pad',
                            maxLength: 2,
                        })}
                    </AVRow>
                </VehicleFormSection>

                <VehicleFormSection
                    icon="tire"
                    title={t('vehicles.form.sections.tires')}
                    subtitle={t('vehicles.form.design.tiresSubtitle')}
                    optionalLabel={optional}
                    open={open.tires}
                    onToggle={() => toggle('tires')}
                    hasError={sectionHasError('tires')}
                >
                    <AVField error={errorText('frontTires')}>
                        <TireSizeSelect
                            title={t('vehicles.form.design.frontTireSize')}
                            value={values.frontTires}
                            onChange={setFrontTires}
                        />
                    </AVField>
                    <AVCheckbox checked={rearSame} label={t('vehicles.form.design.rearSame')} onPress={toggleRearSame} />
                    {!rearSame ? (
                        <AVField error={errorText('rearTires')}>
                            <TireSizeSelect
                                title={t('vehicles.form.design.rearTireSize')}
                                value={values.rearTires}
                                onChange={v => set('rearTires', v)}
                            />
                        </AVField>
                    ) : null}
                    <AVField label={t('vehicles.form.design.spareTire')}>
                        <CatalogSelect
                            kind="spare-tire-types"
                            value={values.spareTireTypeId || null}
                            onChange={id => set('spareTireTypeId', id)}
                            title={t('vehicles.form.design.spareTire')}
                        />
                    </AVField>
                </VehicleFormSection>

                <VehicleFormSection
                    icon="shield"
                    title={t('vehicles.form.sections.insurance')}
                    subtitle={t('vehicles.form.design.insuranceSubtitle')}
                    optionalLabel={optional}
                    open={open.insurance}
                    onToggle={() => toggle('insurance')}
                    hasError={sectionHasError('insurance')}
                >
                    <AVRow flex={[1.6, 1]}>
                        {textField('insuranceCompany', t('vehicles.form.insuranceCompany'), {
                            placeholder: t('vehicles.form.design.insurancePlaceholder'),
                        })}
                        {textField('insuranceCompanyCode', t('vehicles.form.design.naic'), {
                            placeholder: '12345',
                            keyboardType: 'number-pad',
                            maxLength: 5,
                        })}
                    </AVRow>
                    {textField('insurancePolicyNumber', t('vehicles.form.policyNumber'), {
                        placeholder: 'POL-998877-X',
                        upper: true,
                        mono: true,
                    })}
                </VehicleFormSection>

                <VehicleFormSection
                    icon="note"
                    title={t('vehicles.form.sections.additional')}
                    subtitle={t('vehicles.form.design.additionalSubtitle')}
                    open={open.additional}
                    onToggle={() => toggle('additional')}
                    hasError={sectionHasError('additional')}
                >
                    {textField('mileage', t('vehicles.form.mileage'), { placeholder: '0', keyboardType: 'number-pad', maxLength: 8 })}
                    {textField('details', t('vehicles.form.design.notes'), {
                        placeholder: t('vehicles.form.design.notesPlaceholder'),
                        multiline: true,
                    })}
                </VehicleFormSection>
            </ScrollView>

            <View
                style={{
                    paddingHorizontal: 20,
                    paddingTop: 12,
                    paddingBottom: safeBottom ? Math.max(12, insets.bottom) : 12,
                    backgroundColor: '#fff',
                    borderTopWidth: 1,
                    borderTopColor: AV.borderSoft,
                    shadowColor: '#0E2F8A',
                    shadowOffset: { width: 0, height: -8 },
                    shadowOpacity: 0.08,
                    shadowRadius: 10,
                    elevation: 8,
                }}
            >
                <TouchableOpacity onPress={handleSubmit} disabled={!canSave} activeOpacity={0.8}>
                    <LinearGradient
                        colors={vinReady ? [AV.blue, AV.blueDark] : [AV.disabled, AV.disabled]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            borderRadius: 14,
                            paddingVertical: 15,
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: submitting ? 0.7 : 1,
                        }}
                    >
                        {submitting ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="font-outfit-bold" style={{ color: '#fff', fontSize: 15.5 }}>
                                {submitLabel}
                            </Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
                {!vinReady ? (
                    <Text className="font-outfit-regular" style={{ fontSize: 11.5, color: AV.muted, textAlign: 'center', marginTop: 8 }}>
                        {t('vehicles.form.design.saveHint')}
                    </Text>
                ) : null}
            </View>
        </KeyboardAvoidingView>
    );
}
