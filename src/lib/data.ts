

'use server';

import type { NewsArticle, Gadget, CreateGadgetData, LayoutSection, Category, CreateNewsArticleData, SeoSettings, CreateSeoSettingsData, User, Role, CreateUserData, CreateRoleData, Permission, DashboardAnalytics } from './types';
import { connectToDatabase, ObjectId } from './mongodb';
import { initialSampleNewsArticles } from './constants'; 
import { getSession } from '@/app/admin/auth/actions';
// Note: For a real application, use a library like bcrypt for password hashing.
// const bcrypt = require('bcryptjs'); // Example, not used for simplicity in this iteration.

// Helper to map MongoDB document to NewsArticle type
function mapMongoDocumentToNewsArticle(doc: any): NewsArticle {
  if (!doc) return null as any;
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    content: doc.content,
    excerpt: doc.excerpt,
    category: doc.category,
    publishedDate: doc.publishedDate instanceof Date ? doc.publishedDate.toISOString() : doc.publishedDate,
    imageUrl: doc.imageUrl,
    dataAiHint: doc.dataAiHint,
    inlineAdSnippets: doc.inlineAdSnippets || [],
    authorId: doc.authorId,
    // SEO fields
    metaTitle: doc.metaTitle,
    metaDescription: doc.metaDescription,
    metaKeywords: doc.metaKeywords || [],
    ogTitle: doc.ogTitle,
    ogDescription: doc.ogDescription,
    ogImage: doc.ogImage,
    canonicalUrl: doc.canonicalUrl,
    // Article-specific social links
    articleYoutubeUrl: doc.articleYoutubeUrl,
    articleFacebookUrl: doc.articleFacebookUrl,
    articleMoreLinksUrl: doc.articleMoreLinksUrl,
  };
}

// Helper to map MongoDB document to Gadget type
function mapMongoDocumentToGadget(doc: any): Gadget {
  if (!doc) return null as any;
  return {
    id: doc._id.toHexString(),
    section: doc.section || doc.placement, 
    title: doc.title,
    content: doc.content || doc.codeSnippet, 
    isActive: doc.isActive,
    order: doc.order,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
  };
}

// Helper to map MongoDB document to SeoSettings type
function mapMongoDocumentToSeoSettings(doc: any): SeoSettings {
    if (!doc) return null as any;
    return {
        id: doc._id.toHexString(),
        siteTitle: doc.siteTitle,
        metaDescription: doc.metaDescription,
        metaKeywords: doc.metaKeywords || [],
        faviconUrl: doc.faviconUrl,
        ogSiteName: doc.ogSiteName,
        ogLocale: doc.ogLocale,
        ogType: doc.ogType,
        twitterCard: doc.twitterCard,
        twitterSite: doc.twitterSite,
        twitterCreator: doc.twitterCreator,
        updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
        // Footer social links
        footerYoutubeUrl: doc.footerYoutubeUrl,
        footerFacebookUrl: doc.footerFacebookUrl,
        footerMoreLinksUrl: doc.footerMoreLinksUrl,
    };
}

// Helper to map MongoDB document to User type
function mapMongoDocumentToUser(doc: any): User {
  if (!doc) return null as any;
  return {
    id: doc._id.toHexString(),
    username: doc.username,
    email: doc.email,
    passwordHash: doc.passwordHash,
    roles: doc.roles || [],
    isActive: doc.isActive === undefined ? true : doc.isActive,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.createdAt,
  };
}

// Helper to map MongoDB document to Role type
function mapMongoDocumentToRole(doc: any): Role {
  if (!doc) return null as any;
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    permissions: doc.permissions || [],
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.createdAt,
  };
}


export async function getAllNewsArticles(params?: { authorId?: string, startDate?: Date, endDate?: Date }): Promise<NewsArticle[]> {
  try {
    const { db } = await connectToDatabase();
    const articlesCollection = db.collection('articles');
    
    const query: any = {};
    if (params?.authorId) query.authorId = params.authorId;
    if (params?.startDate || params?.endDate) {
      query.publishedDate = {};
      if (params.startDate) query.publishedDate.$gte = params.startDate;
      if (params.endDate) query.publishedDate.$lte = params.endDate;
    }

    const count = await articlesCollection.countDocuments(query);
    if (count === 0 && !params?.authorId && !params?.startDate && !params?.endDate && initialSampleNewsArticles.length > 0) {
        console.log("Seeding initial news articles...");
        const articlesToSeed = initialSampleNewsArticles.map(article => {
            const { id, ...restOfArticle } = article; // Exclude frontend 'id'
            return {
                ...restOfArticle,
                publishedDate: new Date(article.publishedDate), 
                inlineAdSnippets: article.inlineAdSnippets || [],
                authorId: undefined, // Initially no author for seeded articles
                 // SEO fields - ensure they exist or are empty arrays/undefined
                metaTitle: article.metaTitle || '',
                metaDescription: article.metaDescription || '',
                metaKeywords: article.metaKeywords || [],
                ogTitle: article.ogTitle || '',
                ogDescription: article.ogDescription || '',
                ogImage: article.ogImage || '',
                canonicalUrl: article.canonicalUrl || '',
                // Article-specific social links - ensure they are initialized if not present
                articleYoutubeUrl: article.articleYoutubeUrl || '',
                articleFacebookUrl: article.articleFacebookUrl || '',
                articleMoreLinksUrl: article.articleMoreLinksUrl || '',
                _id: new ObjectId(), 
            };
        });
        await articlesCollection.insertMany(articlesToSeed);
        console.log(`${articlesToSeed.length} articles seeded.`);
    }

    const articlesCursor = articlesCollection.find(query).sort({ publishedDate: -1 });
    const articlesArray = await articlesCursor.toArray();
    return articlesArray.map(mapMongoDocumentToNewsArticle);
  } catch (error) {
    console.error("Error fetching all news articles:", error);
    return [];
  }
}

export async function addNewsArticle(articleData: CreateNewsArticleData): Promise<NewsArticle | null> {
  try {
    const { db } = await connectToDatabase();
    const session = await getSession();
    const authorId = session?.userId;

    const newArticleDocument = {
      ...articleData,
      publishedDate: new Date(), 
      inlineAdSnippets: articleData.inlineAdSnippets || [], 
      metaKeywords: Array.isArray(articleData.metaKeywords) ? articleData.metaKeywords : (articleData.metaKeywords ? (articleData.metaKeywords as unknown as string).split(',').map(k => k.trim()).filter(k => k) : []),
      authorId: authorId || undefined, // Add authorId from session
      // Ensure new social link fields are included
      articleYoutubeUrl: articleData.articleYoutubeUrl || undefined,
      articleFacebookUrl: articleData.articleFacebookUrl || undefined,
      articleMoreLinksUrl: articleData.articleMoreLinksUrl || undefined,
      _id: new ObjectId(), 
    };
    const result = await db.collection('articles').insertOne(newArticleDocument);

    if (result.acknowledged && newArticleDocument._id) {
      const insertedDoc = await db.collection('articles').findOne({ _id: newArticleDocument._id });
      return mapMongoDocumentToNewsArticle(insertedDoc);
    }
    console.error("Failed to insert article or retrieve inserted ID.");
    return null;
  } catch (error) {
    console.error("Error adding news article:", error);
    return null;
  }
}

export async function updateNewsArticle(id: string, updates: Partial<Omit<NewsArticle, 'id' | 'publishedDate'>>): Promise<NewsArticle | null> {
  if (!ObjectId.isValid(id)) {
    console.error("Invalid ID for update:", id);
    return null;
  }
  try {
    const { db } = await connectToDatabase();
    const objectId = new ObjectId(id);
    const session = await getSession();
    const authorId = session?.userId;


    const updateDoc: any = { ...updates };
    delete updateDoc.publishedDate; 
    updateDoc.authorId = authorId || updates.authorId; // Prefer session authorId, fallback to existing if any

    if (updateDoc.inlineAdSnippets === undefined) {
        delete updateDoc.inlineAdSnippets; 
    } else if (!Array.isArray(updateDoc.inlineAdSnippets)) {
        updateDoc.inlineAdSnippets = [];
    }
    if (updates.metaKeywords && !Array.isArray(updates.metaKeywords)) {
        updateDoc.metaKeywords = (updates.metaKeywords as unknown as string).split(',').map(k => k.trim()).filter(k => k);
    }
    // Ensure new social link fields are handled in updates
    if (updates.articleYoutubeUrl !== undefined) updateDoc.articleYoutubeUrl = updates.articleYoutubeUrl;
    if (updates.articleFacebookUrl !== undefined) updateDoc.articleFacebookUrl = updates.articleFacebookUrl;
    if (updates.articleMoreLinksUrl !== undefined) updateDoc.articleMoreLinksUrl = updates.articleMoreLinksUrl;


    const result = await db.collection('articles').findOneAndUpdate(
      { _id: objectId },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );
    return result ? mapMongoDocumentToNewsArticle(result) : null;
  } catch (error) {
    console.error("Error updating news article:", error);
    return null;
  }
}

export async function deleteNewsArticle(id: string): Promise<boolean> {
   if (!ObjectId.isValid(id)) {
    console.error("Invalid ID for delete:", id);
    return false;
  }
  try {
    const { db } = await connectToDatabase();
    const objectId = new ObjectId(id);
    const result = await db.collection('articles').deleteOne({ _id: objectId });
    return result.deletedCount === 1;
  } catch (error) {
    console.error("Error deleting news article:", error);
    return false;
  }
}

export async function getArticleById(id: string): Promise<NewsArticle | null> {
  if (!ObjectId.isValid(id)) {
    console.warn("Attempted to fetch article with invalid ID format:", id);
    return null;
  }
  try {
    const { db } = await connectToDatabase();
    const objectId = new ObjectId(id);
    const articleDoc = await db.collection('articles').findOne({ _id: objectId });
    return articleDoc ? mapMongoDocumentToNewsArticle(articleDoc) : null;
  } catch (error) {
    console.error("Error fetching article by ID:", error);
    return null;
  }
}

export async function addGadget(gadgetData: CreateGadgetData): Promise<Gadget | null> {
  try {
    const { db } = await connectToDatabase();
    const newGadgetDocument = {
      section: gadgetData.section,
      title: gadgetData.title,
      content: gadgetData.content,
      isActive: gadgetData.isActive,
      order: gadgetData.order, 
      createdAt: new Date(),
      _id: new ObjectId(),
    };

    const result = await db.collection('advertisements').insertOne(newGadgetDocument);
     if (result.acknowledged && newGadgetDocument._id) {
      const insertedDoc = await db.collection('advertisements').findOne({ _id: newGadgetDocument._id });
      return mapMongoDocumentToGadget(insertedDoc);
    }
    console.error("Failed to insert gadget or retrieve inserted ID.");
    return null;
  } catch (error) {
    console.error("Error adding gadget:", error);
    return null;
  }
}

export async function getAllGadgets(): Promise<Gadget[]> {
  try {
    const { db } = await connectToDatabase();
    const gadgetsCursor = db.collection('advertisements').find({}).sort({ section: 1, order: 1, createdAt: -1 });
    const gadgetsArray = await gadgetsCursor.toArray();
    return gadgetsArray.map(mapMongoDocumentToGadget);
  } catch (error) {
    console.error("Error fetching all gadgets:", error);
    return [];
  }
}

export async function getActiveGadgetsBySection(section: LayoutSection): Promise<Gadget[]> {
  try {
    const { db } = await connectToDatabase();
    let query: any = {
        $or: [ 
            { section: section },
            { placement: section } // Keep for backward compatibility if old data exists
        ],
        isActive: true
    };

    const gadgetsCursor = db.collection('advertisements').find(query).sort({ order: 1, createdAt: -1 });
    const gadgetsArray = await gadgetsCursor.toArray();
    return gadgetsArray.map(mapMongoDocumentToGadget);

  } catch (error) {
    console.error(`Error fetching gadgets for section ${section}:`, error);
    return [];
  }
}

export async function updateGadget(id: string, updates: Partial<Omit<Gadget, 'id' | 'createdAt'>>): Promise<Gadget | null> {
  if (!ObjectId.isValid(id)) {
    console.error("Invalid ID for gadget update:", id);
    return null;
  }
  try {
    const { db } = await connectToDatabase();
    const objectId = new ObjectId(id);

    const updateDoc: any = { ...updates };
    delete updateDoc.createdAt; 
    delete updateDoc.id;      

    // Handle potential old field names 'placement' and 'codeSnippet'
    if (updateDoc.placement && !updateDoc.section) {
        updateDoc.section = updateDoc.placement;
        delete updateDoc.placement;
    }
    if (updateDoc.codeSnippet && !updateDoc.content) {
        updateDoc.content = updateDoc.codeSnippet;
        delete updateDoc.codeSnippet;
    }
    // Remove fields that are not part of the current Gadget type definition to prevent pollution
    delete updateDoc.adType;
    delete updateDoc.imageUrl;
    delete updateDoc.linkUrl;
    delete updateDoc.altText;
    delete updateDoc.articleId; // This was likely for an older ad type not used by gadgets

    const result = await db.collection('advertisements').findOneAndUpdate(
      { _id: objectId },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );
    return result ? mapMongoDocumentToGadget(result) : null;
  } catch (error) {
    console.error("Error updating gadget:", error);
    return null;
  }
}

export async function deleteGadget(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) {
    console.error("Invalid ID for gadget delete:", id);
    return false;
  }
  try {
    const { db } = await connectToDatabase();
    const objectId = new ObjectId(id);
    const result = await db.collection('advertisements').deleteOne({ _id: objectId });
    return result.deletedCount === 1;
  } catch (error) {
    console.error("Error deleting gadget:", error);
    return false;
  }
}

// --- SEO Settings ---
const GLOBAL_SEO_SETTINGS_DOC_ID = "global_seo_settings_doc"; // A unique, fixed string ID for the settings document

export async function getSeoSettings(): Promise<SeoSettings | null> {
    try {
        const { db } = await connectToDatabase();
        const settingsDoc = await db.collection('seo_settings').findOne({ _id: GLOBAL_SEO_SETTINGS_DOC_ID });
        if (settingsDoc) {
             return {
                id: settingsDoc._id.toString(), // Ensure ID is string
                siteTitle: settingsDoc.siteTitle,
                metaDescription: settingsDoc.metaDescription,
                metaKeywords: settingsDoc.metaKeywords || [],
                faviconUrl: settingsDoc.faviconUrl,
                ogSiteName: settingsDoc.ogSiteName,
                ogLocale: settingsDoc.ogLocale,
                ogType: settingsDoc.ogType,
                twitterCard: settingsDoc.twitterCard,
                twitterSite: settingsDoc.twitterSite,
                twitterCreator: settingsDoc.twitterCreator,
                updatedAt: settingsDoc.updatedAt instanceof Date ? settingsDoc.updatedAt.toISOString() : settingsDoc.updatedAt,
                // Footer social links
                footerYoutubeUrl: settingsDoc.footerYoutubeUrl,
                footerFacebookUrl: settingsDoc.footerFacebookUrl,
                footerMoreLinksUrl: settingsDoc.footerMoreLinksUrl,
            };
        }
        // Default SEO settings if nothing found in DB
        return {
            id: GLOBAL_SEO_SETTINGS_DOC_ID,
            siteTitle: "Samay Barta Lite",
            metaDescription: "Your concise news source, powered by AI.",
            metaKeywords: ["news", "bangla news", "ai news", "latest news"],
            faviconUrl: "/favicon.ico",
            ogSiteName: "Samay Barta Lite",
            ogLocale: "bn_BD",
            ogType: "website",
            twitterCard: "summary_large_image",
            updatedAt: new Date().toISOString(),
            footerYoutubeUrl: "https://youtube.com", // Default example
            footerFacebookUrl: "https://facebook.com", // Default example
            footerMoreLinksUrl: "#", // Default example
        };
    } catch (error) {
        console.error("Error fetching SEO settings:", error);
        return { // Fallback default
            id: GLOBAL_SEO_SETTINGS_DOC_ID,
            siteTitle: "Samay Barta Lite - Default",
            metaDescription: "Default description.",
            metaKeywords: [],
            faviconUrl: "/favicon.ico",
            updatedAt: new Date().toISOString(),
            footerYoutubeUrl: "https://youtube.com",
            footerFacebookUrl: "https://facebook.com",
            footerMoreLinksUrl: "#",
        };
    }
}

export async function updateSeoSettings(settingsData: CreateSeoSettingsData): Promise<SeoSettings | null> {
    try {
        const { db } = await connectToDatabase();
        const updateDoc = {
            ...settingsData,
            metaKeywords: Array.isArray(settingsData.metaKeywords) ? settingsData.metaKeywords : (settingsData.metaKeywords || '').split(',').map(k => k.trim()).filter(k => k),
            updatedAt: new Date(),
            // Ensure new footer social links are included
            footerYoutubeUrl: settingsData.footerYoutubeUrl || undefined,
            footerFacebookUrl: settingsData.footerFacebookUrl || undefined,
            footerMoreLinksUrl: settingsData.footerMoreLinksUrl || undefined,
        };
        const result = await db.collection('seo_settings').findOneAndUpdate(
            { _id: GLOBAL_SEO_SETTINGS_DOC_ID },
            { $set: updateDoc },
            { upsert: true, returnDocument: 'after' }
        );
        
        const updatedDocument = result || (result && (result as any).value);

        if (updatedDocument) {
             return {
                id: updatedDocument._id.toString(),
                siteTitle: updatedDocument.siteTitle,
                metaDescription: updatedDocument.metaDescription,
                metaKeywords: updatedDocument.metaKeywords || [],
                faviconUrl: updatedDocument.faviconUrl,
                ogSiteName: updatedDocument.ogSiteName,
                ogLocale: updatedDocument.ogLocale,
                ogType: updatedDocument.ogType,
                twitterCard: updatedDocument.twitterCard,
                twitterSite: updatedDocument.twitterSite,
                twitterCreator: updatedDocument.twitterCreator,
                updatedAt: updatedDocument.updatedAt instanceof Date ? updatedDocument.updatedAt.toISOString() : updatedDocument.updatedAt,
                // Footer social links
                footerYoutubeUrl: updatedDocument.footerYoutubeUrl,
                footerFacebookUrl: updatedDocument.footerFacebookUrl,
                footerMoreLinksUrl: updatedDocument.footerMoreLinksUrl,
            };
        }
        return null;
    } catch (error) {
        console.error("Error updating SEO settings:", error);
        return null;
    }
}

// --- User Management ---
export async function getAllUsers(): Promise<User[]> {
  try {
    const { db } = await connectToDatabase();
    const users = await db.collection('users').find({}).sort({ username: 1 }).toArray();
    return users.map(mapMongoDocumentToUser);
  } catch (error) {
    console.error("Error fetching all users:", error);
    return [];
  }
}

export async function getUserById(id: string): Promise<User | null> {
  if (!ObjectId.isValid(id)) return null;
  try {
    const { db } = await connectToDatabase();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(id) });
    return userDoc ? mapMongoDocumentToUser(userDoc) : null;
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    return null;
  }
}

export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const { db } = await connectToDatabase();
    const userDoc = await db.collection('users').findOne({ username });
    return userDoc ? mapMongoDocumentToUser(userDoc) : null;
  } catch (error) {
    console.error("Error fetching user by username:", error);
    return null;
  }
}

export async function addUser(userData: CreateUserData): Promise<User | null> {
  try {
    const { db } = await connectToDatabase();
    // In a real app, hash the password here:
    // const passwordHash = await bcrypt.hash(userData.password, 10);
    // For simplicity, storing plain text (NOT FOR PRODUCTION):
    if (!userData.password) throw new Error("Password is required for new user.");
    const passwordHash = userData.password; // This is insecure!

    const newUserDocument = {
      username: userData.username,
      email: userData.email,
      passwordHash,
      roles: userData.roles || [],
      isActive: userData.isActive === undefined ? true : userData.isActive,
      createdAt: new Date(),
      updatedAt: new Date(),
      _id: new ObjectId(),
    };
    const result = await db.collection('users').insertOne(newUserDocument);
    if (result.acknowledged && newUserDocument._id) {
        const insertedUser = await db.collection('users').findOne({_id: newUserDocument._id});
        return mapMongoDocumentToUser(insertedUser);
    }
    return null;
  } catch (error) {
    console.error("Error adding user:", error);
    return null;
  }
}

export async function updateUser(id: string, updates: Partial<CreateUserData>): Promise<User | null> {
  if (!ObjectId.isValid(id)) return null;
  try {
    const { db } = await connectToDatabase();
    const updatePayload: any = { ...updates, updatedAt: new Date() };

    if (updates.password) {
      // In a real app, hash the new password
      // updatePayload.passwordHash = await bcrypt.hash(updates.password, 10);
      updatePayload.passwordHash = updates.password; // Insecure
      delete updatePayload.password;
    } else {
      delete updatePayload.password; // Ensure password field is not set if not provided
    }


    const result = await db.collection('users').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updatePayload },
      { returnDocument: 'after' }
    );
    return result ? mapMongoDocumentToUser(result) : null;
  } catch (error) {
    console.error("Error updating user:", error);
    return null;
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('users').deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  } catch (error) {
    console.error("Error deleting user:", error);
    return false;
  }
}

// --- Role Management ---
export async function getAllRoles(): Promise<Role[]> {
  try {
    const { db } = await connectToDatabase();
    const roles = await db.collection('roles').find({}).sort({ name: 1 }).toArray();
    return roles.map(mapMongoDocumentToRole);
  } catch (error) {
    console.error("Error fetching all roles:", error);
    return [];
  }
}

export async function getRoleById(id: string): Promise<Role | null> {
  if (!ObjectId.isValid(id)) return null;
  try {
    const { db } = await connectToDatabase();
    const roleDoc = await db.collection('roles').findOne({ _id: new ObjectId(id) });
    return roleDoc ? mapMongoDocumentToRole(roleDoc) : null;
  } catch (error) {
    console.error("Error fetching role by ID:", error);
    return null;
  }
}

export async function addRole(roleData: CreateRoleData): Promise<Role | null> {
  try {
    const { db } = await connectToDatabase();
    const newRoleDocument = {
      ...roleData,
      createdAt: new Date(),
      updatedAt: new Date(),
      _id: new ObjectId(),
    };
    const result = await db.collection('roles').insertOne(newRoleDocument);
     if (result.acknowledged && newRoleDocument._id) {
        const insertedRole = await db.collection('roles').findOne({_id: newRoleDocument._id});
        return mapMongoDocumentToRole(insertedRole);
    }
    return null;
  } catch (error) {
    console.error("Error adding role:", error);
    return null;
  }
}

export async function updateRole(id: string, updates: Partial<CreateRoleData>): Promise<Role | null> {
  if (!ObjectId.isValid(id)) return null;
  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('roles').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return result ? mapMongoDocumentToRole(result) : null;
  } catch (error) {
    console.error("Error updating role:", error);
    return null;
  }
}

export async function deleteRole(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  try {
    const { db } = await connectToDatabase();
    // Consider implications: what happens to users with this role?
    // For now, just delete the role.
    const result = await db.collection('roles').deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 1) {
        // Optionally, remove this role ID from all users
        await db.collection('users').updateMany(
            { roles: id }, // Find users who have this role ID
            { $pull: { roles: id } } // Remove the role ID from their roles array
        );
        return true;
    }
    return false;
  } catch (error) {
    console.error("Error deleting role:", error);
    return false;
  }
}

export async function getPermissionsForUser(userId: string): Promise<Permission[]> {
  const user = await getUserById(userId);
  if (!user || !user.roles) return [];

  const userRoles = await Promise.all(user.roles.map(roleId => getRoleById(roleId)));
  const permissionsSet = new Set<Permission>();
  userRoles.forEach(role => {
    if (role && role.permissions) {
      role.permissions.forEach(permission => permissionsSet.add(permission));
    }
  });
  return Array.from(permissionsSet);
}


// --- Helper Functions ---
export async function getUsedLayoutSections(): Promise<LayoutSection[]> {
    try {
        const { db } = await connectToDatabase();
        const distinctSections = await db.collection('advertisements').distinct('section') as LayoutSection[];
        const distinctPlacements = await db.collection('advertisements').distinct('placement') as LayoutSection[];
        const allSections = [...new Set([...distinctSections, ...distinctPlacements])];
        return allSections.filter(s => s); 
    } catch (error) {
        console.error("Error fetching distinct layout sections:", error);
        return [];
    }
}

// --- Analytics Data Functions ---
export async function getArticlesStats(): Promise<{ totalArticles: number; articlesToday: number }> {
  try {
    const { db } = await connectToDatabase();
    const articlesCollection = db.collection('articles');

    const totalArticles = await articlesCollection.countDocuments();

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // Start of tomorrow

    const articlesToday = await articlesCollection.countDocuments({
      publishedDate: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    return { totalArticles, articlesToday };
  } catch (error) {
    console.error("Error fetching articles stats:", error);
    return { totalArticles: 0, articlesToday: 0 };
  }
}

export async function getActiveGadgetsCount(): Promise<number> {
  try {
    const { db } = await connectToDatabase();
    const count = await db.collection('advertisements').countDocuments({ isActive: true });
    return count;
  } catch (error) {
    console.error("Error fetching active gadgets count:", error);
    return 0;
  }
}

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  try {
    const articlesStats = await getArticlesStats();
    const users = await getAllUsers(); // This already exists
    const activeGadgets = await getActiveGadgetsCount();

    // Placeholder for visitor stats - requires separate tracking implementation
    const visitorStats = {
      today: 0, // Replace with actual data
      activeNow: 0,
      thisWeek: 0,
      thisMonth: 0,
      lastMonth: 0,
    };

    // Placeholder for user post activity - requires authorId on articles and aggregation logic
    const userPostActivity: any[] = []; 
    // Example: You might fetch users and then count their posts for different periods.
    // This is a simplified example, real implementation would be more complex.
    // for (const user of users) {
    //   const postsToday = await db.collection('articles').countDocuments({ authorId: user.id, publishedDate: { $gte: todayStart }});
    //   userPostActivity.push({ userId: user.id, username: user.username, postsToday });
    // }


    return {
      totalArticles: articlesStats.totalArticles,
      articlesToday: articlesStats.articlesToday,
      totalUsers: users.length,
      activeGadgets,
      visitorStats, // Add this once implemented
      userPostActivity, // Add this once implemented
    };
  } catch (error) {
    console.error("Error fetching dashboard analytics:", error);
    // Return default/empty state on error
    return {
      totalArticles: 0,
      articlesToday: 0,
      totalUsers: 0,
      activeGadgets: 0,
      visitorStats: { today: 0, thisWeek: 0, thisMonth: 0, lastMonth: 0 },
      userPostActivity: [],
    };
  }
}

// --- User Post Activity ---
// This is a more complex function and depends on `authorId` being present in articles.
// It's provided as an example of how you might approach it.
export async function getUserPostCounts(userId: string, period: 'today' | 'thisWeek' | 'thisMonth' | 'thisYear'): Promise<number> {
    if (!ObjectId.isValid(userId)) return 0;

    const now = new Date();
    let startDate: Date;

    switch (period) {
        case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
        case 'thisWeek':
            const firstDayOfWeek = now.getDate() - now.getDay();
            startDate = new Date(now.setDate(firstDayOfWeek));
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'thisMonth':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'thisYear':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        default:
            return 0;
    }

    try {
        const { db } = await connectToDatabase();
        const count = await db.collection('articles').countDocuments({
            authorId: userId,
            publishedDate: { $gte: startDate }
        });
        return count;
    } catch (error) {
        console.error(`Error fetching post count for user ${userId} for period ${period}:`, error);
        return 0;
    }
}

export async function getTopUserPostActivity(limit: number = 5): Promise<any[]> {
    try {
        const { db } = await connectToDatabase();
        const users = await getAllUsers();
        const activity = [];

        const todayStart = new Date();
        todayStart.setHours(0,0,0,0);

        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0,0,0,0);
        
        const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);


        for (const user of users) {
            if (!user.id) continue;
            const postsToday = await db.collection('articles').countDocuments({ authorId: user.id, publishedDate: { $gte: todayStart }});
            const postsThisWeek = await db.collection('articles').countDocuments({ authorId: user.id, publishedDate: { $gte: weekStart }});
            const postsThisMonth = await db.collection('articles').countDocuments({ authorId: user.id, publishedDate: { $gte: monthStart }});
            
            if (postsToday > 0 || postsThisWeek > 0 || postsThisMonth > 0) { // Only include users with some activity
                 activity.push({
                    userId: user.id,
                    username: user.username,
                    postsToday,
                    postsThisWeek,
                    postsThisMonth
                });
            }
        }
        // Sort by most posts this month, then week, then today for tie-breaking
        activity.sort((a,b) => b.postsThisMonth - a.postsThisMonth || b.postsThisWeek - a.postsThisWeek || b.today - a.postsToday);
        return activity.slice(0, limit);

    } catch (error) {
        console.error("Error fetching top user post activity:", error);
        return [];
    }
}

