/* Le consentement aux textos, partagé entre le formulaire (navigateur) et la route
 * /api/lead (serveur). Aucun import ici : le module doit rester importable des deux
 * côtés.
 *
 * Pourquoi c'est là : le scénario de Tyler dans GHL n'envoie un texto qu'aux contacts
 * qui portent le tag `sms-opt-in`. La case avait disparu au déploiement du 23 oct. ;
 * du 24 oct. au 6 nov., aucun des ~300 leads de la page n'a reçu de texto.
 *
 * Règles (TCPA aux États-Unis, LCAP au Canada) :
 *  - la case n'est jamais pré-cochée : le consentement doit être un geste ;
 *  - elle n'est pas obligatoire : le consentement ne peut pas conditionner l'accès aux
 *    pièces ;
 *  - le texte exact accepté est recopié dans la note GHL avec l'heure, comme preuve.
 */

export const SMS_TAG = 'sms-opt-in';

/* Si ce texte change, changer aussi SMS_CONSENT_VERSION : la note GHL garde la version
   acceptée, c'est ce qui permet de retrouver le libellé exact plus tard. */
export const SMS_CONSENT_VERSION = '2026-11-06';
export const SMS_CONSENT_TEXT =
  'Text me my fitment sheet and replies about my build from AZ Motorsport. ' +
  'Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out, HELP for help. ' +
  'Not required to see your parts.';
