// Help Center content mirrored from https://mechanicassistance.com/help (EN) and
// https://mechanicassistance.com/es/help (ES). Only the sections that apply to the app's
// two roles are kept: general help + drivers (user) + technicians (mechanic).
export type HelpGroup = 'general' | 'drivers' | 'technicians';

export interface HelpSection {
    id: string;
    group: HelpGroup;
    title: string;
    items: { q: string; a: string }[];
}

export const HELP_SECTIONS: Record<'en' | 'es', HelpSection[]> = {
    "en": [
        {
            "id": "platform",
            "group": "general",
            "title": "How Mechanic Assistance works",
            "items": [
                {
                    "q": "What is Mechanic Assistance?",
                    "a": "Mechanic Assistance connects vehicle owners and businesses with a service network for on-site assistance, scheduled service and video guidance. Availability depends on the requested service, location and available professionals."
                },
                {
                    "q": "What types of assistance can I request?",
                    "a": "The platform is organized around Immediate Assistance for an issue that needs attention now, Scheduled Assistance for planned maintenance or repair, and Video Assistance for professional guidance when a remote conversation can help."
                },
                {
                    "q": "Do I choose the technician?",
                    "a": "No. Mechanic Assistance assigns an available professional based on the service requested, location, coverage and availability. You review the assignment and service details, then accept or decline it."
                },
                {
                    "q": "Where is service available?",
                    "a": "The published rollout focuses on Miami-Dade, Broward, Palm Beach and the I-4 Corridor. Coverage can vary by service type and provider availability, so confirm your exact location when creating a request."
                },
                {
                    "q": "What happens after I submit a request?",
                    "a": "The request is reviewed against location, service type and network availability. When an appropriate provider is available, you receive the assignment and relevant service details to review before moving forward."
                },
                {
                    "q": "Can Mechanic Assistance handle every repair on-site?",
                    "a": "Not every issue can be completed where the vehicle is located. A technician can assess the situation and explain whether on-site work, towing or further workshop service is the appropriate next step."
                }
            ]
        },
        {
            "id": "accounts",
            "group": "general",
            "title": "Accounts, payments & communication",
            "items": [
                {
                    "q": "How do I access an existing account?",
                    "a": "Use Log in in the navigation or the account access link in the footer. Use the credentials established during registration."
                },
                {
                    "q": "What information should I review before accepting?",
                    "a": "Review the assigned provider, requested service, vehicle details, location, timing and any price information shown. If something is incorrect, do not accept until the request details are clarified."
                },
                {
                    "q": "How are prices handled?",
                    "a": "The platform is designed to present relevant service and price details before confirmation. Final scope can change when inspection reveals additional work; any change should be explained before extra work proceeds."
                },
                {
                    "q": "Where should service communication happen?",
                    "a": "Keep request-related communication in the platform whenever available so the service details remain together. Use the contact information provided for time-sensitive coordination connected to an active request."
                },
                {
                    "q": "How do I correct account or vehicle information?",
                    "a": "Update editable information in your account when that feature is available. For information that cannot be changed, contact the support team and identify the account or request that needs correction."
                }
            ]
        },
        {
            "id": "safety",
            "group": "general",
            "title": "Safety, verification & urgent situations",
            "items": [
                {
                    "q": "Is Mechanic Assistance an emergency service?",
                    "a": "No. If there is immediate danger, a collision with injuries, fire, a hazardous roadway situation or another emergency, contact 911 and follow instructions from local authorities before requesting vehicle service."
                },
                {
                    "q": "How do I prepare for on-site assistance?",
                    "a": "Move to a safe location when possible, turn on hazard lights and share accurate vehicle and location details. Do not remain in an unsafe traffic area while waiting for service."
                },
                {
                    "q": "How is a provider identified?",
                    "a": "Review the assignment shown in the platform before service begins. Confirm the arriving professional or business matches the assignment and do not proceed if the identity or vehicle does not match."
                },
                {
                    "q": "What should I do if something feels unsafe?",
                    "a": "Move away from the situation, do not continue the service interaction and contact local emergency services when needed. Then report the concern to Mechanic Assistance with the request details."
                },
                {
                    "q": "How do I report a service concern?",
                    "a": "Contact the support team and include the request, date, vehicle and a clear description of what occurred. Preserve relevant messages, photos or service records that can help the team review the concern."
                }
            ]
        },
        {
            "id": "drivers",
            "group": "drivers",
            "title": "Help for drivers",
            "items": [
                {
                    "q": "How do I create a clear service request?",
                    "a": "Describe the symptom, when it started, whether the vehicle can move and any warning lights or unusual sounds. Add the correct vehicle and location information so the request can be assessed accurately."
                },
                {
                    "q": "What is Immediate Assistance for?",
                    "a": "Use it for an unexpected vehicle issue that needs prompt attention, such as a no-start condition or a breakdown. It does not replace emergency services and availability varies by location."
                },
                {
                    "q": "When should I schedule assistance?",
                    "a": "Choose Scheduled Assistance for maintenance, inspections, diagnostics or repairs that can be planned. Provide a suitable location and time window, then review the confirmed service details."
                },
                {
                    "q": "What can Video Assistance help with?",
                    "a": "Video guidance can help explain symptoms, warning indicators and possible next steps. A remote conversation cannot replace every physical inspection or repair, and the professional may recommend on-site service."
                },
                {
                    "q": "Can I decline an assignment?",
                    "a": "Yes. Review the assigned professional and available service details before accepting. If the assignment does not work for you, decline it and follow the available options for your request."
                },
                {
                    "q": "What if the vehicle needs towing?",
                    "a": "If the technician determines the vehicle should not be driven or cannot be repaired on-site, towing may be the appropriate next step. Confirm the destination, vehicle condition and service details before transport."
                }
            ]
        },
        {
            "id": "technicians",
            "group": "technicians",
            "title": "Help for technicians",
            "items": [
                {
                    "q": "How do I join the technician network?",
                    "a": "Complete the technician registration path with your experience, service area, availability and requested credentials. The team reviews the information before network participation is confirmed."
                },
                {
                    "q": "How do assignments work?",
                    "a": "Requests are matched using service needs, location, availability and applicable capabilities. Review the request details before accepting and decline work that falls outside your skills, tools or safe operating area."
                },
                {
                    "q": "How should I set availability?",
                    "a": "Keep your status and service area current so assignments reflect when and where you can work. Go offline when unavailable and allow enough travel and service time between accepted requests."
                },
                {
                    "q": "What should I document during service?",
                    "a": "Record the vehicle condition, diagnostic findings, agreed work and relevant completion details. Use clear photos or notes when they help explain the assessment or work performed."
                },
                {
                    "q": "What if the requested work changes?",
                    "a": "Explain what the inspection revealed and do not proceed with additional scope until the customer receives and accepts the updated details. Recommend towing or workshop service when on-site work is not appropriate."
                },
                {
                    "q": "How do certifications affect my profile?",
                    "a": "Certification applies to the individual professional and specific specialties. Keep credentials current and accurately represent the services you are qualified to perform."
                }
            ]
        }
    ],
    "es": [
        {
            "id": "platform",
            "group": "general",
            "title": "Cómo funciona Mechanic Assistance",
            "items": [
                {
                    "q": "¿Qué es Mechanic Assistance?",
                    "a": "Mechanic Assistance conecta a propietarios de vehículos y empresas con una red de servicio para asistencia en sitio, servicios programados y orientación por video. La disponibilidad depende del servicio, la ubicación y los profesionales disponibles."
                },
                {
                    "q": "¿Qué tipos de asistencia puedo solicitar?",
                    "a": "La plataforma se organiza en Asistencia Inmediata para problemas que requieren atención, Asistencia Programada para mantenimiento o reparación planificada y Asistencia por Video cuando una conversación remota puede orientar el próximo paso."
                },
                {
                    "q": "¿Elijo al mecánico?",
                    "a": "No. Mechanic Assistance asigna un profesional disponible según el servicio solicitado, la ubicación, la cobertura y la disponibilidad. Revisás la asignación y los detalles, y luego la aceptás o rechazás."
                },
                {
                    "q": "¿Dónde está disponible el servicio?",
                    "a": "El despliegue publicado se concentra en Miami-Dade, Broward, Palm Beach y el Corredor I-4. La cobertura puede variar según el servicio y la disponibilidad, por eso debés confirmar tu ubicación al crear la solicitud."
                },
                {
                    "q": "¿Qué sucede después de enviar una solicitud?",
                    "a": "La solicitud se revisa según ubicación, tipo de servicio y disponibilidad de la red. Cuando hay un proveedor adecuado, recibís la asignación y los detalles relevantes para revisarlos antes de continuar."
                },
                {
                    "q": "¿Todos los trabajos pueden resolverse en sitio?",
                    "a": "No todos los problemas pueden resolverse donde está el vehículo. Un mecánico puede evaluar la situación y explicar si corresponde trabajo en sitio, remolque o atención posterior en un taller."
                }
            ]
        },
        {
            "id": "accounts",
            "group": "general",
            "title": "Cuentas, pagos y comunicación",
            "items": [
                {
                    "q": "¿Cómo accedo a una cuenta existente?",
                    "a": "Usá Iniciar sesión en la navegación o el acceso a la cuenta en el footer. Utilizá las credenciales definidas durante el registro."
                },
                {
                    "q": "¿Qué información debo revisar antes de aceptar?",
                    "a": "Revisá el proveedor asignado, el servicio, los datos del vehículo, la ubicación, el horario y la información de precio disponible. Si algo es incorrecto, no aceptes hasta aclararlo."
                },
                {
                    "q": "¿Cómo se manejan los precios?",
                    "a": "La plataforma está diseñada para mostrar los detalles de servicio y precio antes de confirmar. El alcance puede cambiar si la inspección detecta trabajo adicional; todo cambio debe explicarse antes de continuar."
                },
                {
                    "q": "¿Dónde debe realizarse la comunicación del servicio?",
                    "a": "Mantené la comunicación de la solicitud dentro de la plataforma cuando esté disponible, así los detalles quedan reunidos. Usá los datos de contacto provistos para coordinar una solicitud activa."
                },
                {
                    "q": "¿Cómo corrijo datos de cuenta o vehículo?",
                    "a": "Actualizá la información editable desde tu cuenta cuando la función esté disponible. Para datos que no puedan modificarse, contactá al equipo e identificá la cuenta o solicitud que necesita corrección."
                }
            ]
        },
        {
            "id": "safety",
            "group": "general",
            "title": "Seguridad, verificación y situaciones urgentes",
            "items": [
                {
                    "q": "¿Mechanic Assistance es un servicio de emergencias?",
                    "a": "No. Si existe peligro inmediato, lesiones, incendio, una situación riesgosa en la vía u otra emergencia, llamá al 911 y seguí las indicaciones de las autoridades antes de solicitar servicio."
                },
                {
                    "q": "¿Cómo me preparo para la asistencia en sitio?",
                    "a": "Ubicate en un lugar seguro cuando sea posible, encendé las balizas y compartí datos precisos del vehículo y la ubicación. No permanezcas en una zona peligrosa del tránsito mientras esperás."
                },
                {
                    "q": "¿Cómo identifico al proveedor?",
                    "a": "Revisá la asignación que aparece en la plataforma antes de comenzar. Confirmá que el profesional o la empresa coincida con la asignación y no continúes si la identidad o el vehículo no corresponden."
                },
                {
                    "q": "¿Qué hago si una situación no parece segura?",
                    "a": "Alejate, no continúes la interacción y contactá a los servicios de emergencia cuando corresponda. Luego informá la situación a Mechanic Assistance con los datos de la solicitud."
                },
                {
                    "q": "¿Cómo reporto un problema con el servicio?",
                    "a": "Contactá al equipo e incluí la solicitud, fecha, vehículo y una descripción clara de lo ocurrido. Conservá mensajes, fotos o registros relevantes que ayuden a revisar el caso."
                }
            ]
        },
        {
            "id": "drivers",
            "group": "drivers",
            "title": "Ayuda para conductores",
            "items": [
                {
                    "q": "¿Cómo creo una solicitud clara?",
                    "a": "Describí el síntoma, cuándo comenzó, si el vehículo puede moverse y si hay luces de advertencia o sonidos inusuales. Agregá datos correctos del vehículo y la ubicación."
                },
                {
                    "q": "¿Para qué sirve la Asistencia Inmediata?",
                    "a": "Usala para un problema inesperado que necesita atención pronta, como un vehículo que no arranca o una avería. No reemplaza a los servicios de emergencia y depende de la ubicación."
                },
                {
                    "q": "¿Cuándo conviene programar asistencia?",
                    "a": "Elegí Asistencia Programada para mantenimiento, inspecciones, diagnósticos o reparaciones planificables. Indicá un lugar y horario adecuados y revisá la confirmación."
                },
                {
                    "q": "¿Para qué sirve la Asistencia por Video?",
                    "a": "La orientación por video puede ayudar a explicar síntomas, testigos y próximos pasos. No reemplaza todas las inspecciones o reparaciones físicas y puede derivar en servicio presencial."
                },
                {
                    "q": "¿Puedo rechazar una asignación?",
                    "a": "Sí. Revisá el profesional asignado y los detalles disponibles antes de aceptar. Si la asignación no te sirve, rechazala y seguí las opciones disponibles."
                },
                {
                    "q": "¿Qué pasa si el vehículo necesita remolque?",
                    "a": "Si el mecánico determina que el vehículo no debe circular o no puede repararse en sitio, el remolque puede ser el próximo paso. Confirmá destino, condición y detalles antes del traslado."
                }
            ]
        },
        {
            "id": "technicians",
            "group": "technicians",
            "title": "Ayuda para mecánicos",
            "items": [
                {
                    "q": "¿Cómo me sumo a la red de mecánicos?",
                    "a": "Completá el registro con tu experiencia, área de servicio, disponibilidad y credenciales solicitadas. El equipo revisa la información antes de confirmar la participación."
                },
                {
                    "q": "¿Cómo funcionan las asignaciones?",
                    "a": "Las solicitudes se asignan según necesidad, ubicación, disponibilidad y capacidades. Revisá los detalles antes de aceptar y rechazá trabajos fuera de tus habilidades, herramientas o zona segura."
                },
                {
                    "q": "¿Cómo configuro mi disponibilidad?",
                    "a": "Mantené actualizado tu estado y área para que las asignaciones reflejen cuándo y dónde podés trabajar. Pasá a offline cuando no estés disponible y contemplá tiempos de viaje y servicio."
                },
                {
                    "q": "¿Qué debo documentar durante el servicio?",
                    "a": "Registrá la condición del vehículo, hallazgos, trabajo acordado y detalles de finalización. Usá fotos o notas claras cuando ayuden a explicar la evaluación o el trabajo."
                },
                {
                    "q": "¿Qué pasa si cambia el trabajo solicitado?",
                    "a": "Explicá lo detectado y no avances con alcance adicional hasta que el cliente reciba y acepte los detalles actualizados. Recomendá remolque o taller cuando corresponda."
                },
                {
                    "q": "¿Cómo influyen las certificaciones en mi perfil?",
                    "a": "La certificación corresponde al profesional y a especialidades específicas. Mantené las credenciales vigentes y representá con precisión los servicios que estás calificado para realizar."
                }
            ]
        }
    ]
};
