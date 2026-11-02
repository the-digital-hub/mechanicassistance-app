import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Input } from '@/components/ui/Input';
import { CatalogSelect } from '@/components/vehicles/CatalogSelect';
import { TireSizeSelect } from '@/components/vehicles/TireSizeSelect';
import { VehicleColorSelect } from '@/components/vehicles/VehicleColorSelect';
import { VehicleFormSection } from '@/components/vehicles/VehicleFormSection';
import type { Vehicle, VehicleDecodedFields } from '@/lib/dao/interfaces';
import { decodeVin, fetchMakes, fetchModelsByMake } from '@/lib/vehicle';
import { TireSize, formatTireSize, parseTireSize } from '@/lib/vehicleTires';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { Children, ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, KeyboardTypeOptions, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
}

type SectionKey = 'vin' | 'info' | 'technical' | 'tires' | 'insurance' | 'additional';

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
type TextFieldKey = Exclude<FieldKey, 'frontTires' | 'rearTires' | 'colorId'>;
type ErrorCode = 'required' | 'vinLength' | 'plateState' | 'naic' | 'number' | 'tireIncomplete';

/** Decoded VIN data that has no field of its own; saved as it came. */
type HiddenDecoded = Pick<
    VehicleDecodedFields,
    'nhtsaVehicleType' | 'manufacturer' | 'fuelTypePrimary' | 'electrificationLevel' | 'plantCountry' | 'vinDecoded'
>;

/** Where each validated field lives, to open its section when it fails. */
const FIELD_SECTION: Partial<Record<FieldKey, SectionKey>> = {
    vin: 'vin',
    make: 'info',
    model: 'info',
    year: 'info',
    plate: 'info',
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
    if (v.vin.trim() && v.vin.trim().length !== 17) errors.vin = 'vinLength';
    if (!v.make) errors.make = 'required';
    if (!v.model) errors.model = 'required';
    if (!v.plate.trim()) errors.plate = 'required';
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

/** Lays fields side by side, each taking an equal share of the width. */
const Row = ({ children }: { children: ReactNode }) => (
    <View className="flex-row gap-3">
        {Children.map(children, child => (
            <View style={{ flex: 1 }}>{child}</View>
        ))}
    </View>
);

/**
 * The vehicle owner's vehicle form, shared by the Vehicles tab and the vehicle
 * step of sign-up. Same fields as the vehicle owner portal, minus the fleet
 * ones (operational status, GPS tracker), which keep their backend defaults.
 */
export function VehicleForm({ initialValue, submitLabel, submitting, onSubmit }: VehicleFormProps) {
    const { t } = useTranslation();
    const [values, setValues] = useState<FormValues>(() => toValues(initialValue));
    const [hidden, setHidden] = useState<HiddenDecoded | null>(null);
    const [errors, setErrors] = useState<Partial<Record<FieldKey, ErrorCode>>>({});
    const [open, setOpen] = useState<Record<SectionKey, boolean>>({
        vin: true,
        info: true,
        technical: false,
        tires: false,
        insurance: false,
        additional: false,
    });
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

    const set = <K extends FieldKey>(key: K, value: FormValues[K]) => {
        setValues(prev => ({ ...prev, [key]: value }));
        setErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev));
    };

    const toggle = (key: SectionKey) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

    const sectionHasError = (key: SectionKey) =>
        (Object.keys(errors) as FieldKey[]).some(f => errors[f] && FIELD_SECTION[f] === key);

    const handleVinLookup = async () => {
        const vin = values.vin.trim();
        if (vin.length !== 17) {
            Alert.alert(t('vehicles.invalidVinTitle'), t('vehicles.invalidVinMessage'));
            return;
        }

        setIsVinSearching(true);
        try {
            await decodeVin(
                vin,
                (make, decodedModel, decoded) => {
                    const model = decodedModel === 'Select' ? '' : decodedModel;
                    setValues(prev => ({
                        ...prev,
                        make,
                        model,
                        year: str(decoded.year) || prev.year,
                        trim: decoded.trim ?? prev.trim,
                        bodyClass: decoded.bodyClass ?? prev.bodyClass,
                        transmissionStyle: decoded.transmissionStyle ?? prev.transmissionStyle,
                        driveType: decoded.driveType ?? prev.driveType,
                        doors: str(decoded.doors) || prev.doors,
                        displacementL: str(decoded.displacementL) || prev.displacementL,
                        engineHp: str(decoded.engineHp) || prev.engineHp,
                        engineCylinders: str(decoded.engineCylinders) || prev.engineCylinders,
                        vehicleTypeId: decoded.vehicleTypeId ?? prev.vehicleTypeId,
                        engineTypeId: decoded.engineTypeId ?? prev.engineTypeId,
                    }));
                    setHidden({
                        nhtsaVehicleType: decoded.nhtsaVehicleType,
                        manufacturer: decoded.manufacturer,
                        fuelTypePrimary: decoded.fuelTypePrimary,
                        electrificationLevel: decoded.electrificationLevel,
                        plantCountry: decoded.plantCountry,
                        vinDecoded: decoded.vinDecoded,
                    });
                    setErrors(prev => ({ ...prev, vin: undefined, make: undefined, model: undefined }));
                    Alert.alert(
                        t('vehicles.vinDecodedTitle'),
                        t('vehicles.vinDecodedMessage', { make, model }),
                        [{ text: t('vehicles.ok') }],
                    );
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

    const field = (key: FieldKey, label: string | null, control: ReactNode) => (
        <View>
            {label ? <Text className="font-outfit-medium text-[#0F172A] mb-2">{label}</Text> : null}
            {control}
            {errors[key] ? (
                <Text className="text-xs font-outfit-regular mt-1" style={{ color: '#EF4444' }}>
                    {t(`vehicles.form.errors.${errors[key]}`)}
                </Text>
            ) : null}
        </View>
    );

    const textField = (
        key: TextFieldKey,
        label: string,
        options: { placeholder?: string; keyboardType?: KeyboardTypeOptions; maxLength?: number; upper?: boolean } = {},
    ) =>
        field(
            key,
            label,
            <Input
                value={values[key]}
                onChangeText={v => set(key, options.upper ? v.toUpperCase() : v)}
                placeholder={options.placeholder}
                keyboardType={options.keyboardType}
                maxLength={options.maxLength}
                // Brand names, codes and plates are not words: autocorrect only mangles them.
                autoCorrect={false}
                autoCapitalize={options.upper ? 'characters' : 'sentences'}
                containerClassName={`bg-white border rounded-[10px] ${errors[key] ? 'border-red-400' : 'border-gray-300'}`}
            />,
        );

    const vinReady = values.vin.trim().length === 17;
    const frontComplete = formatTireSize(values.frontTires) !== null;

    return (
        <View>
            <VehicleFormSection
                title={t('vehicles.form.sections.vin')}
                hint={t('vehicles.form.sections.vinHint')}
                open={open.vin}
                onToggle={() => toggle('vin')}
                hasError={sectionHasError('vin')}
            >
                {field(
                    'vin',
                    t('vehicles.vin'),
                    <View className="flex-row items-center gap-2">
                        <View className="flex-1">
                            <Input
                                value={values.vin}
                                onChangeText={v => {
                                    setHidden(null);
                                    set('vin', v.toUpperCase());
                                }}
                                containerClassName={`bg-white border rounded-[10px] ${errors.vin ? 'border-red-400' : 'border-gray-300'}`}
                                maxLength={17}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                placeholder={t('vehicles.vinPlaceholder')}
                            />
                        </View>
                        <TouchableOpacity
                            onPress={handleVinLookup}
                            disabled={isVinSearching || !vinReady}
                            accessibilityLabel={t('vehicles.form.decodeVin')}
                            style={{
                                width: 52,
                                height: 52,
                                borderRadius: 12,
                                backgroundColor: vinReady ? '#0047AB' : '#CBD5E1',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {isVinSearching ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <Ionicons name="search" size={22} color="white" />
                            )}
                        </TouchableOpacity>
                    </View>,
                )}
                <Text className="text-xs font-outfit-regular text-slate-400 -mt-2">{t('vehicles.form.vinHint')}</Text>
            </VehicleFormSection>

            <VehicleFormSection
                title={t('vehicles.form.sections.info')}
                open={open.info}
                onToggle={() => toggle('info')}
                hasError={sectionHasError('info')}
            >
                {field(
                    'make',
                    t('vehicles.make'),
                    <SearchableSelect
                        options={makeOptions}
                        value={values.make || null}
                        onChange={o => {
                            setValues(prev => ({ ...prev, make: o.value, model: '' }));
                            setErrors(prev => ({ ...prev, make: undefined }));
                        }}
                        placeholder={t('vehicles.select')}
                        title={t('vehicles.selectMake')}
                        searchPlaceholder={t('setup.vehicleInfo.searchMake')}
                        emptyText={t('vehicles.form.noResults')}
                        doneText={t('vehicles.done')}
                        loading={isLoadingMakes}
                        fallbackLabel={values.make || undefined}
                    />,
                )}
                <View style={{ opacity: values.make ? 1 : 0.5 }} pointerEvents={values.make ? 'auto' : 'none'}>
                    {field(
                        'model',
                        t('vehicles.model'),
                        <SearchableSelect
                            options={modelOptions}
                            value={values.model || null}
                            onChange={o => set('model', o.value)}
                            placeholder={t('vehicles.select')}
                            title={t('vehicles.selectModel')}
                            searchPlaceholder={t('setup.vehicleInfo.searchModel')}
                            emptyText={t('vehicles.form.noResults')}
                            doneText={t('vehicles.done')}
                            loading={isLoadingModels}
                            fallbackLabel={values.model || undefined}
                        />,
                    )}
                </View>
                <Row>
                    {textField('year', t('vehicles.form.year'), { placeholder: '2024', keyboardType: 'number-pad', maxLength: 4 })}
                    {textField('trim', t('vehicles.form.trim'), { placeholder: 'LE, XLE…' })}
                </Row>
                {field(
                    'color',
                    t('vehicles.color'),
                    <VehicleColorSelect
                        colorId={values.colorId}
                        legacyColor={values.color}
                        onChange={c => setValues(prev => ({ ...prev, colorId: c.id, color: c.label }))}
                    />,
                )}
                {textField('plate', t('vehicles.form.plateRequired'), { placeholder: 'ABC-1234', upper: true })}
                {textField('plateState', t('vehicles.form.plateState'), { placeholder: 'FL', maxLength: 2, upper: true })}
            </VehicleFormSection>

            <VehicleFormSection
                title={t('vehicles.form.sections.technical')}
                open={open.technical}
                onToggle={() => toggle('technical')}
                hasError={sectionHasError('technical')}
            >
                {field(
                    'vehicleTypeId',
                    t('vehicles.form.vehicleType'),
                    <CatalogSelect
                        kind="vehicle-types"
                        value={values.vehicleTypeId || null}
                        onChange={id => set('vehicleTypeId', id)}
                        title={t('vehicles.form.vehicleType')}
                    />,
                )}
                {field(
                    'engineTypeId',
                    t('vehicles.form.engineType'),
                    <CatalogSelect
                        kind="engine-types"
                        value={values.engineTypeId || null}
                        onChange={id => set('engineTypeId', id)}
                        title={t('vehicles.form.engineType')}
                    />,
                )}
                {field(
                    'fuelTypeId',
                    t('vehicles.form.fuelType'),
                    <CatalogSelect
                        kind="fuel-types"
                        value={values.fuelTypeId || null}
                        onChange={id => set('fuelTypeId', id)}
                        title={t('vehicles.form.fuelType')}
                    />,
                )}
                {textField('bodyClass', t('vehicles.form.bodyClass'), { placeholder: t('vehicles.form.bodyClassPlaceholder') })}
                {textField('transmissionStyle', t('vehicles.form.transmission'), {
                    placeholder: t('vehicles.form.transmissionPlaceholder'),
                })}
                {textField('driveType', t('vehicles.form.driveType'), { placeholder: 'FWD, RWD, AWD, 4WD…' })}
                <Row>
                    {textField('doors', t('vehicles.form.doors'), { placeholder: '4', keyboardType: 'number-pad', maxLength: 2 })}
                    {textField('engineCylinders', t('vehicles.form.cylinders'), {
                        placeholder: '4',
                        keyboardType: 'number-pad',
                        maxLength: 2,
                    })}
                </Row>
                <Row>
                    {textField('displacementL', t('vehicles.form.displacement'), {
                        placeholder: '2.5',
                        keyboardType: 'decimal-pad',
                        maxLength: 5,
                    })}
                    {textField('engineHp', t('vehicles.form.horsepower'), {
                        placeholder: '203',
                        keyboardType: 'number-pad',
                        maxLength: 4,
                    })}
                </Row>
            </VehicleFormSection>

            <VehicleFormSection
                title={t('vehicles.form.sections.tires')}
                hint={t('vehicles.form.sections.tiresHint')}
                open={open.tires}
                onToggle={() => toggle('tires')}
                hasError={sectionHasError('tires')}
            >
                {field(
                    'frontTires',
                    null,
                    <TireSizeSelect
                        title={t('vehicles.form.frontTires')}
                        value={values.frontTires}
                        onChange={v => set('frontTires', v)}
                    />,
                )}
                {field(
                    'rearTires',
                    null,
                    <TireSizeSelect
                        title={t('vehicles.form.rearTires')}
                        value={values.rearTires}
                        onChange={v => set('rearTires', v)}
                    />,
                )}
                <TouchableOpacity
                    onPress={() => set('rearTires', { ...values.frontTires })}
                    disabled={!frontComplete}
                    style={{ opacity: frontComplete ? 1 : 0.4, alignSelf: 'flex-start' }}
                >
                    <Text className="text-blue-600 font-outfit-semibold">{t('vehicles.form.sameAsFront')}</Text>
                </TouchableOpacity>
                {field(
                    'spareTireTypeId',
                    t('vehicles.form.spareTire'),
                    <CatalogSelect
                        kind="spare-tire-types"
                        value={values.spareTireTypeId || null}
                        onChange={id => set('spareTireTypeId', id)}
                        title={t('vehicles.form.spareTire')}
                    />,
                )}
            </VehicleFormSection>

            <VehicleFormSection
                title={t('vehicles.form.sections.insurance')}
                hint={t('vehicles.form.sections.insuranceHint')}
                open={open.insurance}
                onToggle={() => toggle('insurance')}
                hasError={sectionHasError('insurance')}
            >
                {textField('insuranceCompany', t('vehicles.form.insuranceCompany'), {
                    placeholder: 'Geico, Progressive, State Farm…',
                })}
                {textField('insuranceCompanyCode', t('vehicles.form.naicCode'), {
                    placeholder: '12345',
                    keyboardType: 'number-pad',
                    maxLength: 5,
                })}
                {textField('insurancePolicyNumber', t('vehicles.form.policyNumber'), {
                    placeholder: 'POL-998877-X',
                    upper: true,
                })}
            </VehicleFormSection>

            <VehicleFormSection
                title={t('vehicles.form.sections.additional')}
                open={open.additional}
                onToggle={() => toggle('additional')}
                hasError={sectionHasError('additional')}
            >
                {textField('mileage', t('vehicles.form.mileage'), { placeholder: '0', keyboardType: 'number-pad', maxLength: 8 })}
                {field(
                    'details',
                    t('vehicles.furtherDetails'),
                    <TextInput
                        multiline
                        numberOfLines={3}
                        value={values.details}
                        onChangeText={v => set('details', v)}
                        placeholder={t('vehicles.form.detailsPlaceholder')}
                        placeholderTextColor="#9CA3AF"
                        className="bg-white border border-gray-300 rounded-[10px] p-4 font-outfit-regular text-[#0F172A] text-base h-24"
                        style={{ textAlignVertical: 'top' }}
                    />,
                )}
            </VehicleFormSection>

            <TouchableOpacity onPress={handleSubmit} disabled={submitting} activeOpacity={0.8} className="mt-2">
                <LinearGradient
                    colors={['#2B66F8', '#081E72']}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                        borderRadius: 10,
                        paddingVertical: 16,
                        paddingHorizontal: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: submitting ? 0.6 : 1,
                    }}
                >
                    {submitting ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Text className="text-white font-outfit-bold text-center mr-2">{submitLabel}</Text>
                            <ChevronRight size={20} color="white" />
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}
