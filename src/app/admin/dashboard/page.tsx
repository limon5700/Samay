"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { TrashIcon } from "@radix-ui/react-icons";
import { deleteArticle, getAllArticles } from "@/lib/articles";
import { Article } from "@prisma/client";

export default function DeleteArticleDialog() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [articleId, setArticleId] = useState("");
  const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);

  useEffect(() => {
    async function fetchArticles() {
      const fetchedArticles = await getAllArticles();
      setArticles(fetchedArticles);
    }

    fetchArticles();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!articleId) {
      toast({
        title: "Validation Error",
        description: "Please select an article ID.",
      });
      return;
    }

    const selectedArticle = articles.find((article) => article.id === articleId);
    if (!selectedArticle) {
      toast({
        title: "Error",
        description: "Selected article not found.",
      });
      return;
    }

    setArticleToDelete(selectedArticle);
  };

  const confirmDelete = async () => {
    if (!articleToDelete) return;

    try {
      await deleteArticle(articleToDelete.id);
      toast({
        title: "Article Deleted",
        description: `The article "${articleToDelete.title}" has been deleted.`,
      });
      setArticles((prev) => prev.filter((article) => article.id !== articleToDelete.id));
      setArticleToDelete(null);
      setArticleId("");
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete the article.",
      });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <TrashIcon className="mr-2 h-4 w-4" />
          Delete Article
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Article</DialogTitle>
        </DialogHeader>
        {!articleToDelete ? (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="articleId" className="text-right">
                  Article ID
                </Label>
                <Input
                  id="articleId"
                  value={articleId}
                  onChange={(e) => setArticleId(e.target.value)}
                  className="col-span-3"
                  placeholder="Enter Article ID"
                  list="article-ids"
                />
                <datalist id="article-ids">
                  {articles.map((article) => (
                    <option key={article.id} value={article.id}>
                      {article.title}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Next</Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <p>
              Are you sure you want to delete the article "{articleToDelete?.title}"? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setArticleToDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                Confirm Delete
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
